/* =====================================================
   Sistema LBTR - Motor de Liquidacion
   Logica de procesamiento de transferencias,
   gestion de liquidez y cola de operaciones
   ===================================================== */

var LBTREngine = {
    processTransfer: function(transferData) {
        var sender = LBTRData.getParticipant(transferData.sender);
        var receiver = LBTRData.getParticipant(transferData.receiver);

        if (!sender || !receiver) {
            return { success: false, reason: 'Participante no encontrado' };
        }

        if (sender.status !== 'ACTIVO') {
            return { success: false, reason: 'Banco ordenante no esta activo' };
        }

        if (receiver.status !== 'ACTIVO') {
            return { success: false, reason: 'Banco beneficiario no esta activo' };
        }

        if (transferData.sender === transferData.receiver) {
            return { success: false, reason: 'Ordenante y beneficiario no pueden ser iguales' };
        }

        var amount = parseFloat(transferData.amount);
        if (isNaN(amount) || amount <= 0) {
            return { success: false, reason: 'Monto invalido' };
        }

        var balanceField = transferData.currency === 'USD' ? 'balanceUSD' : 'balancePEN';
        var availableFunds = sender[balanceField];
        if (transferData.currency === 'PEN') {
            availableFunds += sender.creditLine;
        }

        var txId = LBTRData.generateTxId();
        var now = new Date().toISOString();
        var tx = {
            id: txId,
            timestamp: now,
            sender: transferData.sender,
            receiver: transferData.receiver,
            currency: transferData.currency,
            amount: amount,
            concept: transferData.concept,
            priority: transferData.priority,
            status: 'PENDIENTE',
            reference: transferData.reference,
            processedAt: null,
            rejectReason: null
        };

        if (amount <= availableFunds) {
            sender[balanceField] -= amount;
            receiver[balanceField] += amount;
            tx.status = 'LIQUIDADA';
            tx.processedAt = now;

            LBTRData.transactions.unshift(tx);
            LBTRData.save();

            this.addAuditLog('TRANSFERENCIA', 'Transferencia ' + txId + ' liquidada: ' +
                transferData.currency + ' ' + this.formatNumber(amount) +
                ' de ' + transferData.sender + ' a ' + transferData.receiver);

            this.addNotification('Transferencia Liquidada',
                txId + ': ' + transferData.currency + ' ' + this.formatNumber(amount) +
                ' (' + transferData.sender + ' -> ' + transferData.receiver + ')',
                'success');

            return { success: true, txId: txId, status: 'LIQUIDADA' };
        } else {
            tx.status = 'EN_COLA';
            LBTRData.transactions.unshift(tx);

            LBTRData.queue.push({
                txId: txId,
                timestamp: now,
                sender: transferData.sender,
                receiver: transferData.receiver,
                amount: amount,
                currency: transferData.currency,
                priority: transferData.priority,
                reason: 'Fondos insuficientes - Disponible: ' +
                    transferData.currency + ' ' + this.formatNumber(availableFunds) +
                    ', Requerido: ' + transferData.currency + ' ' + this.formatNumber(amount)
            });

            LBTRData.save();

            this.addAuditLog('TRANSFERENCIA', 'Transferencia ' + txId + ' en cola por fondos insuficientes');
            this.addNotification('Transferencia en Cola',
                txId + ': Fondos insuficientes para ' + transferData.currency + ' ' + this.formatNumber(amount),
                'warning');

            return { success: true, txId: txId, status: 'EN_COLA' };
        }
    },

    processQueue: function() {
        var processed = 0;
        var failed = 0;
        var priorityOrder = { 'CRITICA': 0, 'URGENTE': 1, 'NORMAL': 2 };

        LBTRData.queue.sort(function(a, b) {
            var pa = priorityOrder[a.priority] !== undefined ? priorityOrder[a.priority] : 2;
            var pb = priorityOrder[b.priority] !== undefined ? priorityOrder[b.priority] : 2;
            if (pa !== pb) return pa - pb;
            return new Date(a.timestamp) - new Date(b.timestamp);
        });

        var remainingQueue = [];

        for (var i = 0; i < LBTRData.queue.length; i++) {
            var qItem = LBTRData.queue[i];
            var sender = LBTRData.getParticipant(qItem.sender);
            var receiver = LBTRData.getParticipant(qItem.receiver);

            if (!sender || !receiver) {
                remainingQueue.push(qItem);
                continue;
            }

            var balanceField = qItem.currency === 'USD' ? 'balanceUSD' : 'balancePEN';
            var availableFunds = sender[balanceField];
            if (qItem.currency === 'PEN') {
                availableFunds += sender.creditLine;
            }

            if (qItem.amount <= availableFunds) {
                sender[balanceField] -= qItem.amount;
                receiver[balanceField] += qItem.amount;

                for (var j = 0; j < LBTRData.transactions.length; j++) {
                    if (LBTRData.transactions[j].id === qItem.txId) {
                        LBTRData.transactions[j].status = 'LIQUIDADA';
                        LBTRData.transactions[j].processedAt = new Date().toISOString();
                        break;
                    }
                }
                processed++;
            } else {
                remainingQueue.push(qItem);
                failed++;
            }
        }

        LBTRData.queue = remainingQueue;
        LBTRData.save();

        if (processed > 0) {
            this.addAuditLog('SISTEMA', 'Procesamiento de cola: ' + processed + ' liquidadas, ' + failed + ' pendientes');
            this.addNotification('Cola Procesada',
                processed + ' operaciones liquidadas, ' + failed + ' pendientes', 'info');
        }

        return { processed: processed, pending: failed };
    },

    rejectQueueItem: function(txId) {
        for (var i = 0; i < LBTRData.queue.length; i++) {
            if (LBTRData.queue[i].txId === txId) {
                LBTRData.queue.splice(i, 1);
                break;
            }
        }

        for (var j = 0; j < LBTRData.transactions.length; j++) {
            if (LBTRData.transactions[j].id === txId) {
                LBTRData.transactions[j].status = 'RECHAZADA';
                LBTRData.transactions[j].rejectReason = 'Rechazada manualmente por operador';
                break;
            }
        }

        LBTRData.save();
        this.addAuditLog('TRANSFERENCIA', 'Operacion ' + txId + ' rechazada manualmente');
    },

    processDeposit: function(participantCode, currency, amount, reason) {
        var participant = LBTRData.getParticipant(participantCode);
        if (!participant) return { success: false, reason: 'Participante no encontrado' };

        var numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) return { success: false, reason: 'Monto invalido' };

        var balanceField = currency === 'USD' ? 'balanceUSD' : 'balancePEN';
        participant[balanceField] += numAmount;

        var symbol = currency === 'USD' ? '$' : 'S/';
        LBTRData.liquidityOps.unshift({
            timestamp: new Date().toISOString(),
            type: 'DEPOSITO',
            participant: participantCode,
            currency: currency,
            amount: numAmount,
            reason: reason
        });

        LBTRData.save();
        this.addAuditLog('LIQUIDEZ', 'Deposito: ' + symbol + ' ' + this.formatNumber(numAmount) + ' a ' + participantCode + ' - ' + reason);
        this.addNotification('Deposito Registrado',
            symbol + ' ' + this.formatNumber(numAmount) + ' depositado en cuenta de ' + participantCode, 'success');

        return { success: true };
    },

    processWithdraw: function(participantCode, currency, amount, reason) {
        var participant = LBTRData.getParticipant(participantCode);
        if (!participant) return { success: false, reason: 'Participante no encontrado' };

        var numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) return { success: false, reason: 'Monto invalido' };

        var balanceField = currency === 'USD' ? 'balanceUSD' : 'balancePEN';
        if (participant[balanceField] < numAmount) {
            return { success: false, reason: 'Saldo insuficiente' };
        }

        participant[balanceField] -= numAmount;

        var symbol = currency === 'USD' ? '$' : 'S/';
        LBTRData.liquidityOps.unshift({
            timestamp: new Date().toISOString(),
            type: 'RETIRO',
            participant: participantCode,
            currency: currency,
            amount: numAmount,
            reason: reason
        });

        LBTRData.save();
        this.addAuditLog('LIQUIDEZ', 'Retiro: ' + symbol + ' ' + this.formatNumber(numAmount) + ' de ' + participantCode + ' - ' + reason);
        this.addNotification('Retiro Registrado',
            symbol + ' ' + this.formatNumber(numAmount) + ' retirado de cuenta de ' + participantCode, 'warning');

        return { success: true };
    },

    processForexOperation: function(data) {
        var buyer = LBTRData.getParticipant(data.buyer);
        var seller = LBTRData.getParticipant(data.seller);

        if (!buyer || !seller) return { success: false, reason: 'Participante no encontrado' };
        if (data.buyer === data.seller) return { success: false, reason: 'Comprador y vendedor no pueden ser iguales' };

        var amountUSD = parseFloat(data.amountUSD);
        var rate = parseFloat(data.rate);
        if (isNaN(amountUSD) || amountUSD <= 0) return { success: false, reason: 'Monto USD invalido' };
        if (isNaN(rate) || rate <= 0) return { success: false, reason: 'Tipo de cambio invalido' };

        var amountPEN = Math.round(amountUSD * rate * 100) / 100;

        if (seller.balanceUSD < amountUSD) {
            return { success: false, reason: 'Vendedor sin saldo USD suficiente' };
        }
        if (buyer.balancePEN < amountPEN) {
            return { success: false, reason: 'Comprador sin saldo PEN suficiente' };
        }

        buyer.balancePEN -= amountPEN;
        buyer.balanceUSD += amountUSD;
        seller.balancePEN += amountPEN;
        seller.balanceUSD -= amountUSD;

        var fxId = LBTRData.generateFxId();
        LBTRData.forexOperations.unshift({
            id: fxId,
            timestamp: new Date().toISOString(),
            type: data.type,
            buyer: data.buyer,
            seller: data.seller,
            amountUSD: amountUSD,
            rate: rate,
            amountPEN: amountPEN,
            status: 'LIQUIDADA'
        });

        LBTRData.save();
        this.addAuditLog('FOREX', 'Operacion ' + fxId + ': ' + data.type + ' USD ' +
            this.formatNumber(amountUSD) + ' a TC ' + rate.toFixed(3) +
            ' (' + data.buyer + '/' + data.seller + ')');
        this.addNotification('Operacion Forex Liquidada',
            fxId + ': USD ' + this.formatNumber(amountUSD) + ' a TC ' + rate.toFixed(3), 'success');

        return { success: true, fxId: fxId };
    },

    addParticipant: function(data) {
        if (LBTRData.getParticipant(data.code)) {
            return { success: false, reason: 'Codigo de participante ya existe' };
        }

        LBTRData.participants.push({
            code: data.code,
            name: data.name,
            shortName: data.shortName,
            ruc: data.ruc,
            type: data.type,
            balancePEN: parseFloat(data.balancePEN) || 0,
            balanceUSD: parseFloat(data.balanceUSD) || 0,
            creditLine: parseFloat(data.creditLine) || 0,
            status: 'ACTIVO',
            joinDate: new Date().toISOString().split('T')[0]
        });

        LBTRData.save();
        this.addAuditLog('SISTEMA', 'Nuevo participante registrado: ' + data.code + ' - ' + data.name);
        this.addNotification('Nuevo Participante', data.name + ' registrado en el sistema', 'info');

        return { success: true };
    },

    toggleParticipantStatus: function(code) {
        var p = LBTRData.getParticipant(code);
        if (!p) return;
        if (p.code === 'BCRP') return;

        p.status = p.status === 'ACTIVO' ? 'SUSPENDIDO' : 'ACTIVO';
        LBTRData.save();
        this.addAuditLog('SISTEMA', 'Participante ' + code + ' cambiado a estado: ' + p.status);
    },

    getStats: function() {
        var today = new Date().toISOString().split('T')[0];
        var todayTx = LBTRData.transactions.filter(function(tx) {
            return tx.timestamp.split('T')[0] === today;
        });

        var liquidadas = todayTx.filter(function(tx) { return tx.status === 'LIQUIDADA'; });
        var pendientes = todayTx.filter(function(tx) { return tx.status === 'PENDIENTE' || tx.status === 'EN_COLA'; });
        var rechazadas = todayTx.filter(function(tx) { return tx.status === 'RECHAZADA'; });

        var montoTotal = 0;
        for (var i = 0; i < liquidadas.length; i++) {
            if (liquidadas[i].currency === 'PEN') {
                montoTotal += liquidadas[i].amount;
            } else {
                montoTotal += liquidadas[i].amount * LBTRData.exchangeRates.reference;
            }
        }

        var activeParticipants = LBTRData.getActiveParticipants().length;

        var hourlyData = {};
        for (var h = 9; h <= 17; h++) {
            hourlyData[h] = 0;
        }
        for (var j = 0; j < todayTx.length; j++) {
            var txHour = new Date(todayTx[j].timestamp).getHours();
            if (hourlyData[txHour] !== undefined) {
                hourlyData[txHour]++;
            }
        }

        var totalLiqPEN = 0;
        var totalLiqUSD = 0;
        for (var k = 0; k < LBTRData.participants.length; k++) {
            totalLiqPEN += LBTRData.participants[k].balancePEN;
            totalLiqUSD += LBTRData.participants[k].balanceUSD;
        }

        return {
            totalTx: todayTx.length,
            liquidadas: liquidadas.length,
            pendientes: pendientes.length,
            rechazadas: rechazadas.length,
            montoTotal: montoTotal,
            activeParticipants: activeParticipants,
            hourlyData: hourlyData,
            statusData: {
                liquidadas: liquidadas.length,
                pendientes: pendientes.length,
                rechazadas: rechazadas.length
            },
            totalLiqPEN: totalLiqPEN,
            totalLiqUSD: totalLiqUSD
        };
    },

    getQueueStats: function() {
        var totalAmount = 0;
        var urgentCount = 0;
        for (var i = 0; i < LBTRData.queue.length; i++) {
            totalAmount += LBTRData.queue[i].amount;
            if (LBTRData.queue[i].priority === 'URGENTE' || LBTRData.queue[i].priority === 'CRITICA') {
                urgentCount++;
            }
        }
        return {
            pending: LBTRData.queue.length,
            totalAmount: totalAmount,
            urgent: urgentCount
        };
    },

    getForexStats: function() {
        var today = new Date().toISOString().split('T')[0];
        var todayOps = LBTRData.forexOperations.filter(function(op) {
            return op.timestamp.split('T')[0] === today;
        });
        var volume = 0;
        for (var i = 0; i < todayOps.length; i++) {
            volume += todayOps[i].amountUSD;
        }
        return {
            operations: todayOps.length,
            volume: volume
        };
    },

    generateReport: function(type) {
        var stats = this.getStats();
        var html = '';

        switch(type) {
            case 'diario':
                html = this.generateDailyReport(stats);
                break;
            case 'participante':
                html = this.generateParticipantReport();
                break;
            case 'liquidez':
                html = this.generateLiquidityReport(stats);
                break;
            case 'forex':
                html = this.generateForexReport();
                break;
            case 'resumen':
                html = this.generateSummaryReport(stats);
                break;
        }
        return html;
    },

    generateDailyReport: function(stats) {
        var html = '<h2 style="color:#1a237e;margin-bottom:16px;">Reporte Diario de Operaciones LBTR</h2>';
        html += '<p style="color:#64748b;margin-bottom:20px;">Fecha: ' + new Date().toLocaleDateString('es-PE') + '</p>';

        html += '<div class="report-summary">';
        html += '<div class="report-stat"><h4>' + stats.totalTx + '</h4><p>Total Transacciones</p></div>';
        html += '<div class="report-stat"><h4>' + stats.liquidadas + '</h4><p>Liquidadas</p></div>';
        html += '<div class="report-stat"><h4>' + stats.pendientes + '</h4><p>En Cola</p></div>';
        html += '<div class="report-stat"><h4>' + stats.rechazadas + '</h4><p>Rechazadas</p></div>';
        html += '<div class="report-stat"><h4>S/ ' + this.formatNumber(stats.montoTotal) + '</h4><p>Monto Total Liquidado</p></div>';
        html += '</div>';

        html += '<h3 style="margin:20px 0 10px;">Detalle de Transacciones</h3>';
        html += '<table class="report-table"><thead><tr>';
        html += '<th>ID</th><th>Hora</th><th>Ordenante</th><th>Beneficiario</th><th>Moneda</th><th>Monto</th><th>Estado</th>';
        html += '</tr></thead><tbody>';

        var txList = LBTRData.transactions.slice(0, 50);
        for (var i = 0; i < txList.length; i++) {
            var tx = txList[i];
            html += '<tr>';
            html += '<td>' + tx.id + '</td>';
            html += '<td>' + new Date(tx.timestamp).toLocaleTimeString('es-PE') + '</td>';
            html += '<td>' + tx.sender + '</td>';
            html += '<td>' + tx.receiver + '</td>';
            html += '<td>' + tx.currency + '</td>';
            html += '<td style="text-align:right">' + this.formatNumber(tx.amount) + '</td>';
            html += '<td>' + tx.status + '</td>';
            html += '</tr>';
        }
        html += '</tbody></table>';
        return html;
    },

    generateParticipantReport: function() {
        var html = '<h2 style="color:#1a237e;margin-bottom:16px;">Reporte por Participante</h2>';
        html += '<p style="color:#64748b;margin-bottom:20px;">Fecha: ' + new Date().toLocaleDateString('es-PE') + '</p>';

        html += '<table class="report-table"><thead><tr>';
        html += '<th>Codigo</th><th>Entidad</th><th>Saldo PEN</th><th>Saldo USD</th><th>Tx Enviadas</th><th>Tx Recibidas</th><th>Estado</th>';
        html += '</tr></thead><tbody>';

        for (var i = 0; i < LBTRData.participants.length; i++) {
            var p = LBTRData.participants[i];
            var sent = LBTRData.transactions.filter(function(tx) { return tx.sender === p.code; }).length;
            var received = LBTRData.transactions.filter(function(tx) { return tx.receiver === p.code; }).length;

            html += '<tr>';
            html += '<td>' + p.code + '</td>';
            html += '<td>' + p.name + '</td>';
            html += '<td style="text-align:right">S/ ' + this.formatNumber(p.balancePEN) + '</td>';
            html += '<td style="text-align:right">$ ' + this.formatNumber(p.balanceUSD) + '</td>';
            html += '<td style="text-align:center">' + sent + '</td>';
            html += '<td style="text-align:center">' + received + '</td>';
            html += '<td>' + p.status + '</td>';
            html += '</tr>';
        }
        html += '</tbody></table>';
        return html;
    },

    generateLiquidityReport: function(stats) {
        var html = '<h2 style="color:#1a237e;margin-bottom:16px;">Reporte de Liquidez del Sistema</h2>';
        html += '<p style="color:#64748b;margin-bottom:20px;">Fecha: ' + new Date().toLocaleDateString('es-PE') + '</p>';

        html += '<div class="report-summary">';
        html += '<div class="report-stat"><h4>S/ ' + this.formatNumber(stats.totalLiqPEN) + '</h4><p>Liquidez Total PEN</p></div>';
        html += '<div class="report-stat"><h4>$ ' + this.formatNumber(stats.totalLiqUSD) + '</h4><p>Liquidez Total USD</p></div>';
        html += '<div class="report-stat"><h4>' + stats.activeParticipants + '</h4><p>Participantes Activos</p></div>';
        html += '</div>';

        html += '<h3 style="margin:20px 0 10px;">Operaciones de Liquidez Recientes</h3>';
        html += '<table class="report-table"><thead><tr>';
        html += '<th>Fecha/Hora</th><th>Tipo</th><th>Participante</th><th>Moneda</th><th>Monto</th><th>Motivo</th>';
        html += '</tr></thead><tbody>';

        var ops = LBTRData.liquidityOps.slice(0, 20);
        for (var i = 0; i < ops.length; i++) {
            var op = ops[i];
            var symbol = op.currency === 'USD' ? '$' : 'S/';
            html += '<tr>';
            html += '<td>' + new Date(op.timestamp).toLocaleString('es-PE') + '</td>';
            html += '<td>' + op.type + '</td>';
            html += '<td>' + op.participant + '</td>';
            html += '<td>' + op.currency + '</td>';
            html += '<td style="text-align:right">' + symbol + ' ' + this.formatNumber(op.amount) + '</td>';
            html += '<td>' + op.reason + '</td>';
            html += '</tr>';
        }
        html += '</tbody></table>';
        return html;
    },

    generateForexReport: function() {
        var html = '<h2 style="color:#1a237e;margin-bottom:16px;">Reporte de Operaciones de Moneda Extranjera</h2>';
        html += '<p style="color:#64748b;margin-bottom:20px;">Fecha: ' + new Date().toLocaleDateString('es-PE') + '</p>';

        var fxStats = this.getForexStats();
        html += '<div class="report-summary">';
        html += '<div class="report-stat"><h4>' + fxStats.operations + '</h4><p>Operaciones Hoy</p></div>';
        html += '<div class="report-stat"><h4>$ ' + this.formatNumber(fxStats.volume) + '</h4><p>Volumen Total USD</p></div>';
        html += '<div class="report-stat"><h4>S/ ' + LBTRData.exchangeRates.buy.toFixed(3) + '</h4><p>TC Compra</p></div>';
        html += '<div class="report-stat"><h4>S/ ' + LBTRData.exchangeRates.sell.toFixed(3) + '</h4><p>TC Venta</p></div>';
        html += '</div>';

        html += '<table class="report-table"><thead><tr>';
        html += '<th>ID</th><th>Fecha/Hora</th><th>Tipo</th><th>Comprador</th><th>Vendedor</th><th>USD</th><th>TC</th><th>PEN</th>';
        html += '</tr></thead><tbody>';

        for (var i = 0; i < LBTRData.forexOperations.length; i++) {
            var op = LBTRData.forexOperations[i];
            html += '<tr>';
            html += '<td>' + op.id + '</td>';
            html += '<td>' + new Date(op.timestamp).toLocaleString('es-PE') + '</td>';
            html += '<td>' + op.type + '</td>';
            html += '<td>' + op.buyer + '</td>';
            html += '<td>' + op.seller + '</td>';
            html += '<td style="text-align:right">$ ' + this.formatNumber(op.amountUSD) + '</td>';
            html += '<td>' + op.rate.toFixed(3) + '</td>';
            html += '<td style="text-align:right">S/ ' + this.formatNumber(op.amountPEN) + '</td>';
            html += '</tr>';
        }
        html += '</tbody></table>';
        return html;
    },

    generateSummaryReport: function(stats) {
        var fxStats = this.getForexStats();
        var queueStats = this.getQueueStats();

        var html = '<h2 style="color:#1a237e;margin-bottom:16px;">Resumen Ejecutivo - Sistema LBTR</h2>';
        html += '<p style="color:#64748b;margin-bottom:20px;">Banco Central de Reserva del Peru - ' + new Date().toLocaleDateString('es-PE') + '</p>';

        html += '<h3 style="margin:20px 0 10px;color:#1a237e;">1. Resumen de Operaciones</h3>';
        html += '<div class="report-summary">';
        html += '<div class="report-stat"><h4>' + stats.totalTx + '</h4><p>Transacciones Totales</p></div>';
        html += '<div class="report-stat"><h4>' + stats.liquidadas + '</h4><p>Liquidadas</p></div>';
        html += '<div class="report-stat"><h4>S/ ' + this.formatNumber(stats.montoTotal) + '</h4><p>Monto Total</p></div>';
        html += '<div class="report-stat"><h4>' + ((stats.totalTx > 0 ? (stats.liquidadas / stats.totalTx * 100) : 0).toFixed(1)) + '%</h4><p>Tasa de Liquidacion</p></div>';
        html += '</div>';

        html += '<h3 style="margin:20px 0 10px;color:#1a237e;">2. Liquidez del Sistema</h3>';
        html += '<div class="report-summary">';
        html += '<div class="report-stat"><h4>S/ ' + this.formatNumber(stats.totalLiqPEN) + '</h4><p>Total PEN</p></div>';
        html += '<div class="report-stat"><h4>$ ' + this.formatNumber(stats.totalLiqUSD) + '</h4><p>Total USD</p></div>';
        html += '<div class="report-stat"><h4>' + stats.activeParticipants + '</h4><p>Participantes Activos</p></div>';
        html += '</div>';

        html += '<h3 style="margin:20px 0 10px;color:#1a237e;">3. Cola de Operaciones</h3>';
        html += '<div class="report-summary">';
        html += '<div class="report-stat"><h4>' + queueStats.pending + '</h4><p>Pendientes</p></div>';
        html += '<div class="report-stat"><h4>S/ ' + this.formatNumber(queueStats.totalAmount) + '</h4><p>Monto en Cola</p></div>';
        html += '<div class="report-stat"><h4>' + queueStats.urgent + '</h4><p>Urgentes</p></div>';
        html += '</div>';

        html += '<h3 style="margin:20px 0 10px;color:#1a237e;">4. Operaciones de Moneda Extranjera</h3>';
        html += '<div class="report-summary">';
        html += '<div class="report-stat"><h4>' + fxStats.operations + '</h4><p>Operaciones Forex</p></div>';
        html += '<div class="report-stat"><h4>$ ' + this.formatNumber(fxStats.volume) + '</h4><p>Volumen USD</p></div>';
        html += '<div class="report-stat"><h4>S/ ' + LBTRData.exchangeRates.reference.toFixed(3) + '</h4><p>TC Referencia</p></div>';
        html += '</div>';

        return html;
    },

    addAuditLog: function(type, description) {
        var user = sessionStorage.getItem('lbtr_user') || 'SYSTEM';
        var entity = sessionStorage.getItem('lbtr_entity') || 'BCRP';

        LBTRData.auditLog.unshift({
            timestamp: new Date().toISOString(),
            type: type,
            user: user,
            entity: entity,
            description: description,
            ip: '192.168.1.' + Math.floor(Math.random() * 254 + 1)
        });

        if (LBTRData.auditLog.length > 500) {
            LBTRData.auditLog = LBTRData.auditLog.slice(0, 500);
        }

        LBTRData.save();
    },

    addNotification: function(title, message, type) {
        LBTRData.notifications.unshift({
            timestamp: new Date().toISOString(),
            title: title,
            message: message,
            type: type || 'info',
            read: false
        });

        if (LBTRData.notifications.length > 100) {
            LBTRData.notifications = LBTRData.notifications.slice(0, 100);
        }

        LBTRData.save();
    },

    formatNumber: function(num) {
        return parseFloat(num).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
};
