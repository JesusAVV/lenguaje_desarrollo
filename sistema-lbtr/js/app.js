/* =====================================================
   Sistema LBTR - Controlador Principal
   Maneja la interfaz de usuario y la interaccion
   ===================================================== */

var LBTR = {
    currentSection: 'dashboard',
    clockInterval: null,

    init: function() {
        LBTRData.load();
        LBTRData.generateSeedTransactions();
        this.bindEvents();
        this.startClock();
    },

    bindEvents: function() {
        var self = this;

        document.getElementById('loginForm').addEventListener('submit', function(e) {
            e.preventDefault();
            self.handleLogin();
        });

        document.getElementById('logoutBtn').addEventListener('click', function() {
            self.handleLogout();
        });

        document.getElementById('toggleSidebar').addEventListener('click', function() {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });

        var menuItems = document.querySelectorAll('.sidebar-menu li');
        for (var i = 0; i < menuItems.length; i++) {
            menuItems[i].addEventListener('click', function() {
                self.navigateTo(this.getAttribute('data-section'));
            });
        }

        document.getElementById('newTransferForm').addEventListener('submit', function(e) {
            e.preventDefault();
            self.submitTransfer();
        });

        document.getElementById('liqForm').addEventListener('submit', function(e) {
            e.preventDefault();
            self.submitLiquidity();
        });

        document.getElementById('newForexForm').addEventListener('submit', function(e) {
            e.preventDefault();
            self.submitForex();
        });

        document.getElementById('notificationBell').addEventListener('click', function() {
            self.toggleNotifications();
        });

        document.getElementById('searchParticipant').addEventListener('input', function() {
            self.renderParticipants(this.value);
        });
    },

    startClock: function() {
        var self = this;
        function updateClock() {
            var now = new Date();
            var time = now.toLocaleTimeString('es-PE', { hour12: false });
            var date = now.toLocaleDateString('es-PE');
            document.getElementById('systemClock').textContent = time;
            document.getElementById('systemDate').textContent = date;
        }
        updateClock();
        this.clockInterval = setInterval(updateClock, 1000);
    },

    handleLogin: function() {
        var user = document.getElementById('loginUser').value;
        var pass = document.getElementById('loginPass').value;
        var entity = document.getElementById('loginEntity').value;

        if (!user || !pass || !entity) {
            this.showToast('Error', 'Complete todos los campos', 'error');
            return;
        }

        if (user === 'admin' && pass === 'admin') {
            sessionStorage.setItem('lbtr_user', user);
            sessionStorage.setItem('lbtr_entity', entity);

            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            document.getElementById('userDisplayName').textContent = user.charAt(0).toUpperCase() + user.slice(1);
            document.getElementById('userEntity').textContent = entity;

            LBTREngine.addAuditLog('LOGIN', 'Inicio de sesion: ' + user + ' (' + entity + ')');
            LBTREngine.addNotification('Inicio de Sesion', 'Bienvenido al Sistema LBTR', 'info');

            this.navigateTo('dashboard');
            this.showToast('Bienvenido', 'Sesion iniciada correctamente', 'success');
        } else {
            this.showToast('Error de Autenticacion', 'Usuario o contrasena incorrectos', 'error');
        }
    },

    handleLogout: function() {
        LBTREngine.addAuditLog('LOGIN', 'Cierre de sesion');
        sessionStorage.removeItem('lbtr_user');
        sessionStorage.removeItem('lbtr_entity');
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('loginForm').reset();
    },

    navigateTo: function(section) {
        this.currentSection = section;

        var menuItems = document.querySelectorAll('.sidebar-menu li');
        for (var i = 0; i < menuItems.length; i++) {
            menuItems[i].classList.remove('active');
            if (menuItems[i].getAttribute('data-section') === section) {
                menuItems[i].classList.add('active');
            }
        }

        var sections = document.querySelectorAll('.section');
        for (var j = 0; j < sections.length; j++) {
            sections[j].classList.remove('active');
        }

        var target = document.getElementById('section-' + section);
        if (target) target.classList.add('active');

        var titles = {
            dashboard: 'Dashboard',
            participantes: 'Gestion de Participantes',
            transferencias: 'Transferencias Interbancarias',
            liquidez: 'Gestion de Liquidez',
            cola: 'Cola de Operaciones',
            forex: 'Moneda Extranjera',
            reportes: 'Reportes y Estadisticas',
            auditoria: 'Auditoria y Seguridad'
        };
        document.getElementById('breadcrumb').innerHTML = '<span>' + (titles[section] || section) + '</span>';

        this.refreshSection(section);
    },

    refreshSection: function(section) {
        switch(section) {
            case 'dashboard': this.refreshDashboard(); break;
            case 'participantes': this.renderParticipants(); break;
            case 'transferencias': this.renderTransfers(); break;
            case 'liquidez': this.renderLiquidity(); break;
            case 'cola': this.renderQueue(); break;
            case 'forex': this.renderForex(); break;
            case 'reportes': LBTRCharts.updateReportCharts(); break;
            case 'auditoria': this.renderAuditLog(); break;
        }
        this.updateNotificationBadge();
    },

    refreshDashboard: function() {
        var stats = LBTREngine.getStats();

        document.getElementById('kpiTotalTx').textContent = stats.totalTx;
        document.getElementById('kpiLiquidadas').textContent = stats.liquidadas;
        document.getElementById('kpiPendientes').textContent = stats.pendientes;
        document.getElementById('kpiRechazadas').textContent = stats.rechazadas;
        document.getElementById('kpiMontoTotal').textContent = 'S/ ' + LBTREngine.formatNumber(stats.montoTotal);
        document.getElementById('kpiParticipantes').textContent = stats.activeParticipants;

        LBTRCharts.updateDashboardCharts(stats);

        var tbody = document.getElementById('recentTxBody');
        tbody.innerHTML = '';
        var recent = LBTRData.transactions.slice(0, 10);
        for (var i = 0; i < recent.length; i++) {
            var tx = recent[i];
            var statusClass = tx.status.toLowerCase().replace('_', '-');
            var priorityClass = tx.priority.toLowerCase();
            var symbol = tx.currency === 'USD' ? '$ ' : 'S/ ';

            var row = '<tr>';
            row += '<td><strong>' + tx.id + '</strong></td>';
            row += '<td>' + new Date(tx.timestamp).toLocaleTimeString('es-PE') + '</td>';
            row += '<td>' + tx.sender + '</td>';
            row += '<td>' + tx.receiver + '</td>';
            row += '<td class="amount">' + symbol + LBTREngine.formatNumber(tx.amount) + '</td>';
            row += '<td><span class="status-badge ' + statusClass + '">' + tx.status + '</span></td>';
            row += '<td><span class="priority-badge ' + priorityClass + '">' + tx.priority + '</span></td>';
            row += '</tr>';
            tbody.innerHTML += row;
        }
    },

    renderParticipants: function(filter) {
        var tbody = document.getElementById('participantsBody');
        tbody.innerHTML = '';
        var participants = LBTRData.participants;

        if (filter) {
            var f = filter.toLowerCase();
            participants = participants.filter(function(p) {
                return p.code.toLowerCase().indexOf(f) !== -1 ||
                       p.name.toLowerCase().indexOf(f) !== -1 ||
                       p.ruc.indexOf(f) !== -1;
            });
        }

        for (var i = 0; i < participants.length; i++) {
            var p = participants[i];
            var statusClass = p.status.toLowerCase();
            var row = '<tr>';
            row += '<td><strong>' + p.code + '</strong></td>';
            row += '<td>' + p.name + '</td>';
            row += '<td>' + p.ruc + '</td>';
            row += '<td>' + p.type.replace('_', ' ') + '</td>';
            row += '<td class="amount">S/ ' + LBTREngine.formatNumber(p.balancePEN) + '</td>';
            row += '<td class="amount">$ ' + LBTREngine.formatNumber(p.balanceUSD) + '</td>';
            row += '<td><span class="status-badge ' + statusClass + '">' + p.status + '</span></td>';
            row += '<td>';
            row += '<button class="action-btn view" title="Ver detalle" onclick="LBTR.viewParticipant(\'' + p.code + '\')"><i class="fas fa-eye"></i></button>';
            if (p.code !== 'BCRP') {
                row += '<button class="action-btn edit" title="Cambiar estado" onclick="LBTREngine.toggleParticipantStatus(\'' + p.code + '\');LBTR.renderParticipants()"><i class="fas fa-toggle-on"></i></button>';
            }
            row += '</td>';
            row += '</tr>';
            tbody.innerHTML += row;
        }
    },

    viewParticipant: function(code) {
        var p = LBTRData.getParticipant(code);
        if (!p) return;

        var sent = LBTRData.transactions.filter(function(tx) { return tx.sender === code; });
        var received = LBTRData.transactions.filter(function(tx) { return tx.receiver === code; });

        var html = '';
        html += '<div class="detail-row"><span class="label">Codigo</span><span class="value">' + p.code + '</span></div>';
        html += '<div class="detail-row"><span class="label">Nombre</span><span class="value">' + p.name + '</span></div>';
        html += '<div class="detail-row"><span class="label">RUC</span><span class="value">' + p.ruc + '</span></div>';
        html += '<div class="detail-row"><span class="label">Tipo</span><span class="value">' + p.type.replace('_', ' ') + '</span></div>';
        html += '<div class="detail-row"><span class="label">Saldo PEN</span><span class="value">S/ ' + LBTREngine.formatNumber(p.balancePEN) + '</span></div>';
        html += '<div class="detail-row"><span class="label">Saldo USD</span><span class="value">$ ' + LBTREngine.formatNumber(p.balanceUSD) + '</span></div>';
        html += '<div class="detail-row"><span class="label">Linea de Credito</span><span class="value">S/ ' + LBTREngine.formatNumber(p.creditLine) + '</span></div>';
        html += '<div class="detail-row"><span class="label">Estado</span><span class="value">' + p.status + '</span></div>';
        html += '<div class="detail-row"><span class="label">Fecha Ingreso</span><span class="value">' + p.joinDate + '</span></div>';
        html += '<div class="detail-row"><span class="label">Tx Enviadas</span><span class="value">' + sent.length + '</span></div>';
        html += '<div class="detail-row"><span class="label">Tx Recibidas</span><span class="value">' + received.length + '</span></div>';

        this.showModal('Detalle del Participante: ' + p.shortName, html);
    },

    showAddParticipant: function() {
        var html = '<form id="addParticipantForm" onsubmit="LBTR.submitNewParticipant(event)">';
        html += '<div class="form-grid">';
        html += '<div class="form-group"><label>Codigo</label><input type="text" id="newPCode" required maxlength="10" placeholder="Ej: BANCO1"></div>';
        html += '<div class="form-group"><label>Nombre Corto</label><input type="text" id="newPShort" required placeholder="Nombre corto"></div>';
        html += '<div class="form-group full-width"><label>Nombre Completo</label><input type="text" id="newPName" required placeholder="Nombre completo de la entidad"></div>';
        html += '<div class="form-group"><label>RUC</label><input type="text" id="newPRuc" required maxlength="11" pattern="[0-9]{11}" placeholder="20XXXXXXXXX"></div>';
        html += '<div class="form-group"><label>Tipo</label><select id="newPType" required>';
        html += '<option value="BANCA_MULTIPLE">Banca Multiple</option>';
        html += '<option value="FINANCIERA">Financiera</option>';
        html += '<option value="CAJA_MUNICIPAL">Caja Municipal</option>';
        html += '<option value="CAJA_RURAL">Caja Rural</option>';
        html += '</select></div>';
        html += '<div class="form-group"><label>Saldo Inicial PEN</label><input type="number" id="newPBalPEN" step="0.01" min="0" value="0" placeholder="0.00"></div>';
        html += '<div class="form-group"><label>Saldo Inicial USD</label><input type="number" id="newPBalUSD" step="0.01" min="0" value="0" placeholder="0.00"></div>';
        html += '<div class="form-group"><label>Linea de Credito PEN</label><input type="number" id="newPCredit" step="0.01" min="0" value="0" placeholder="0.00"></div>';
        html += '<div class="form-actions full-width"><button type="submit" class="btn btn-primary"><i class="fas fa-check"></i> Registrar</button>';
        html += '<button type="button" class="btn btn-outline" onclick="LBTR.closeModal()">Cancelar</button></div>';
        html += '</div></form>';

        this.showModal('Registrar Nuevo Participante', html);
    },

    submitNewParticipant: function(e) {
        e.preventDefault();
        var result = LBTREngine.addParticipant({
            code: document.getElementById('newPCode').value.toUpperCase(),
            name: document.getElementById('newPName').value,
            shortName: document.getElementById('newPShort').value,
            ruc: document.getElementById('newPRuc').value,
            type: document.getElementById('newPType').value,
            balancePEN: document.getElementById('newPBalPEN').value,
            balanceUSD: document.getElementById('newPBalUSD').value,
            creditLine: document.getElementById('newPCredit').value
        });

        if (result.success) {
            this.closeModal();
            this.renderParticipants();
            this.showToast('Participante Registrado', 'El nuevo participante ha sido registrado exitosamente', 'success');
        } else {
            this.showToast('Error', result.reason, 'error');
        }
    },

    showNewTransfer: function() {
        document.getElementById('transferForm').style.display = 'block';
        this.populateBankSelects();
    },

    hideTransferForm: function() {
        document.getElementById('transferForm').style.display = 'none';
        document.getElementById('newTransferForm').reset();
    },

    populateBankSelects: function() {
        var selects = ['txOrdenante', 'txBeneficiario', 'liqParticipant', 'fxBuyer', 'fxSeller'];
        var active = LBTRData.getActiveParticipants();

        for (var i = 0; i < selects.length; i++) {
            var sel = document.getElementById(selects[i]);
            if (!sel) continue;

            var firstOption = sel.options[0];
            sel.innerHTML = '';
            sel.appendChild(firstOption);

            for (var j = 0; j < active.length; j++) {
                var opt = document.createElement('option');
                opt.value = active[j].code;
                opt.textContent = active[j].code + ' - ' + active[j].shortName;
                sel.appendChild(opt);
            }
        }
    },

    submitTransfer: function() {
        var data = {
            sender: document.getElementById('txOrdenante').value,
            receiver: document.getElementById('txBeneficiario').value,
            currency: document.getElementById('txMoneda').value,
            amount: document.getElementById('txMonto').value,
            priority: document.getElementById('txPrioridad').value,
            concept: document.getElementById('txConcepto').value,
            reference: document.getElementById('txReferencia').value
        };

        if (data.sender === data.receiver) {
            this.showToast('Error', 'El ordenante y beneficiario no pueden ser iguales', 'error');
            return;
        }

        var result = LBTREngine.processTransfer(data);

        if (result.success) {
            this.hideTransferForm();
            this.renderTransfers();

            if (result.status === 'LIQUIDADA') {
                this.showToast('Transferencia Liquidada',
                    'Operacion ' + result.txId + ' procesada exitosamente', 'success');
            } else {
                this.showToast('Transferencia en Cola',
                    'Operacion ' + result.txId + ' en espera por fondos insuficientes', 'warning');
            }
        } else {
            this.showToast('Error', result.reason, 'error');
        }
    },

    renderTransfers: function() {
        var tbody = document.getElementById('transfersBody');
        tbody.innerHTML = '';

        var filterStatus = document.getElementById('filterStatus').value;
        var filterCurrency = document.getElementById('filterCurrency').value;
        var filterPriority = document.getElementById('filterPriority').value;

        var txList = LBTRData.transactions.filter(function(tx) {
            if (filterStatus && tx.status !== filterStatus) return false;
            if (filterCurrency && tx.currency !== filterCurrency) return false;
            if (filterPriority && tx.priority !== filterPriority) return false;
            return true;
        });

        document.getElementById('txCount').textContent = txList.length + ' registros';

        for (var i = 0; i < txList.length; i++) {
            var tx = txList[i];
            var statusClass = tx.status.toLowerCase().replace('_', '-');
            var priorityClass = tx.priority.toLowerCase();
            var symbol = tx.currency === 'USD' ? '$ ' : 'S/ ';

            var row = '<tr>';
            row += '<td><strong>' + tx.id + '</strong></td>';
            row += '<td>' + new Date(tx.timestamp).toLocaleString('es-PE') + '</td>';
            row += '<td>' + tx.sender + '</td>';
            row += '<td>' + tx.receiver + '</td>';
            row += '<td>' + tx.currency + '</td>';
            row += '<td class="amount">' + symbol + LBTREngine.formatNumber(tx.amount) + '</td>';
            row += '<td>' + tx.concept.replace('_', ' ') + '</td>';
            row += '<td><span class="priority-badge ' + priorityClass + '">' + tx.priority + '</span></td>';
            row += '<td><span class="status-badge ' + statusClass + '">' + tx.status + '</span></td>';
            row += '<td><button class="action-btn view" title="Ver detalle" onclick="LBTR.viewTransaction(\'' + tx.id + '\')"><i class="fas fa-eye"></i></button></td>';
            row += '</tr>';
            tbody.innerHTML += row;
        }
    },

    filterTransactions: function() {
        this.renderTransfers();
    },

    viewTransaction: function(txId) {
        var tx = null;
        for (var i = 0; i < LBTRData.transactions.length; i++) {
            if (LBTRData.transactions[i].id === txId) {
                tx = LBTRData.transactions[i];
                break;
            }
        }
        if (!tx) return;

        var symbol = tx.currency === 'USD' ? '$ ' : 'S/ ';
        var html = '';
        html += '<div class="detail-row"><span class="label">ID Operacion</span><span class="value">' + tx.id + '</span></div>';
        html += '<div class="detail-row"><span class="label">Fecha/Hora</span><span class="value">' + new Date(tx.timestamp).toLocaleString('es-PE') + '</span></div>';
        html += '<div class="detail-row"><span class="label">Banco Ordenante</span><span class="value">' + tx.sender + '</span></div>';
        html += '<div class="detail-row"><span class="label">Banco Beneficiario</span><span class="value">' + tx.receiver + '</span></div>';
        html += '<div class="detail-row"><span class="label">Moneda</span><span class="value">' + tx.currency + '</span></div>';
        html += '<div class="detail-row"><span class="label">Monto</span><span class="value">' + symbol + LBTREngine.formatNumber(tx.amount) + '</span></div>';
        html += '<div class="detail-row"><span class="label">Concepto</span><span class="value">' + tx.concept.replace('_', ' ') + '</span></div>';
        html += '<div class="detail-row"><span class="label">Prioridad</span><span class="value">' + tx.priority + '</span></div>';
        html += '<div class="detail-row"><span class="label">Estado</span><span class="value">' + tx.status + '</span></div>';
        html += '<div class="detail-row"><span class="label">Referencia</span><span class="value">' + tx.reference + '</span></div>';

        if (tx.processedAt) {
            html += '<div class="detail-row"><span class="label">Procesada</span><span class="value">' + new Date(tx.processedAt).toLocaleString('es-PE') + '</span></div>';
        }
        if (tx.rejectReason) {
            html += '<div class="detail-row"><span class="label">Motivo Rechazo</span><span class="value" style="color:#c62828">' + tx.rejectReason + '</span></div>';
        }

        this.showModal('Detalle de Transferencia: ' + tx.id, html);
    },

    showDepositForm: function() {
        document.getElementById('liquidityForm').style.display = 'block';
        document.getElementById('liqType').value = 'DEPOSITO';
        document.getElementById('liquidityFormTitle').innerHTML = '<i class="fas fa-plus-circle"></i> Registrar Deposito';
        this.populateBankSelects();
    },

    showWithdrawForm: function() {
        document.getElementById('liquidityForm').style.display = 'block';
        document.getElementById('liqType').value = 'RETIRO';
        document.getElementById('liquidityFormTitle').innerHTML = '<i class="fas fa-minus-circle"></i> Registrar Retiro';
        this.populateBankSelects();
    },

    hideLiquidityForm: function() {
        document.getElementById('liquidityForm').style.display = 'none';
        document.getElementById('liqForm').reset();
    },

    submitLiquidity: function() {
        var type = document.getElementById('liqType').value;
        var participant = document.getElementById('liqParticipant').value;
        var currency = document.getElementById('liqCurrency').value;
        var amount = document.getElementById('liqAmount').value;
        var reason = document.getElementById('liqReason').value;

        var result;
        if (type === 'DEPOSITO') {
            result = LBTREngine.processDeposit(participant, currency, amount, reason);
        } else {
            result = LBTREngine.processWithdraw(participant, currency, amount, reason);
        }

        if (result.success) {
            this.hideLiquidityForm();
            this.renderLiquidity();
            this.showToast(type + ' Exitoso',
                'Operacion de ' + type.toLowerCase() + ' registrada', 'success');
        } else {
            this.showToast('Error', result.reason, 'error');
        }
    },

    renderLiquidity: function() {
        var stats = LBTREngine.getStats();
        document.getElementById('totalLiqPEN').textContent = 'S/ ' + LBTREngine.formatNumber(stats.totalLiqPEN);
        document.getElementById('totalLiqUSD').textContent = '$ ' + LBTREngine.formatNumber(stats.totalLiqUSD);

        var balBody = document.getElementById('balancesBody');
        balBody.innerHTML = '';
        for (var i = 0; i < LBTRData.participants.length; i++) {
            var p = LBTRData.participants[i];
            var available = p.balancePEN + p.creditLine;
            var statusClass = p.status.toLowerCase();

            var row = '<tr>';
            row += '<td><strong>' + p.code + '</strong></td>';
            row += '<td>' + p.shortName + '</td>';
            row += '<td class="amount">S/ ' + LBTREngine.formatNumber(p.balancePEN) + '</td>';
            row += '<td class="amount">$ ' + LBTREngine.formatNumber(p.balanceUSD) + '</td>';
            row += '<td class="amount">S/ ' + LBTREngine.formatNumber(p.creditLine) + '</td>';
            row += '<td class="amount" style="font-weight:700">S/ ' + LBTREngine.formatNumber(available) + '</td>';
            row += '<td><span class="status-badge ' + statusClass + '">' + p.status + '</span></td>';
            row += '</tr>';
            balBody.innerHTML += row;
        }

        var liqBody = document.getElementById('liqHistoryBody');
        liqBody.innerHTML = '';
        var ops = LBTRData.liquidityOps.slice(0, 20);
        for (var j = 0; j < ops.length; j++) {
            var op = ops[j];
            var symbol = op.currency === 'USD' ? '$ ' : 'S/ ';
            var row2 = '<tr>';
            row2 += '<td>' + new Date(op.timestamp).toLocaleString('es-PE') + '</td>';
            row2 += '<td><span class="status-badge ' + (op.type === 'DEPOSITO' ? 'activo' : 'suspendido') + '">' + op.type + '</span></td>';
            row2 += '<td>' + op.participant + '</td>';
            row2 += '<td>' + op.currency + '</td>';
            row2 += '<td class="amount">' + symbol + LBTREngine.formatNumber(op.amount) + '</td>';
            row2 += '<td>' + op.reason + '</td>';
            row2 += '</tr>';
            liqBody.innerHTML += row2;
        }
    },

    renderQueue: function() {
        var qStats = LBTREngine.getQueueStats();
        document.getElementById('queuePending').textContent = qStats.pending;
        document.getElementById('queueAmount').textContent = 'S/ ' + LBTREngine.formatNumber(qStats.totalAmount);
        document.getElementById('queueUrgent').textContent = qStats.urgent;

        var tbody = document.getElementById('queueBody');
        tbody.innerHTML = '';

        var priorityOrder = { 'CRITICA': 0, 'URGENTE': 1, 'NORMAL': 2 };
        var sortedQueue = LBTRData.queue.slice().sort(function(a, b) {
            var pa = priorityOrder[a.priority] !== undefined ? priorityOrder[a.priority] : 2;
            var pb = priorityOrder[b.priority] !== undefined ? priorityOrder[b.priority] : 2;
            return pa - pb;
        });

        for (var i = 0; i < sortedQueue.length; i++) {
            var q = sortedQueue[i];
            var priorityClass = q.priority.toLowerCase();
            var symbol = q.currency === 'USD' ? '$ ' : 'S/ ';

            var row = '<tr>';
            row += '<td><strong>' + (i + 1) + '</strong></td>';
            row += '<td>' + q.txId + '</td>';
            row += '<td>' + new Date(q.timestamp).toLocaleTimeString('es-PE') + '</td>';
            row += '<td>' + q.sender + '</td>';
            row += '<td>' + q.receiver + '</td>';
            row += '<td class="amount">' + symbol + LBTREngine.formatNumber(q.amount) + '</td>';
            row += '<td><span class="priority-badge ' + priorityClass + '">' + q.priority + '</span></td>';
            row += '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">' + q.reason + '</td>';
            row += '<td>';
            row += '<button class="action-btn process" title="Reintentar" onclick="LBTR.retryQueueItem(\'' + q.txId + '\')"><i class="fas fa-redo"></i></button>';
            row += '<button class="action-btn delete" title="Rechazar" onclick="LBTR.rejectQueueItem(\'' + q.txId + '\')"><i class="fas fa-times"></i></button>';
            row += '</td>';
            row += '</tr>';
            tbody.innerHTML += row;
        }

        if (sortedQueue.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:#94a3b8;">No hay operaciones en cola</td></tr>';
        }
    },

    processQueue: function() {
        var result = LBTREngine.processQueue();
        this.renderQueue();
        this.showToast('Cola Procesada',
            result.processed + ' operaciones liquidadas, ' + result.pending + ' pendientes',
            result.processed > 0 ? 'success' : 'info');
    },

    retryQueueItem: function(txId) {
        this.processQueue();
    },

    rejectQueueItem: function(txId) {
        LBTREngine.rejectQueueItem(txId);
        this.renderQueue();
        this.showToast('Operacion Rechazada', 'La operacion ' + txId + ' ha sido rechazada', 'warning');
    },

    clearQueue: function() {
        var rejected = [];
        for (var i = LBTRData.queue.length - 1; i >= 0; i--) {
            var qItem = LBTRData.queue[i];
            for (var j = 0; j < LBTRData.transactions.length; j++) {
                if (LBTRData.transactions[j].id === qItem.txId &&
                    LBTRData.transactions[j].status === 'RECHAZADA') {
                    rejected.push(i);
                    break;
                }
            }
        }
        for (var k = 0; k < rejected.length; k++) {
            LBTRData.queue.splice(rejected[k], 1);
        }
        LBTRData.save();
        this.renderQueue();
    },

    showForexForm: function() {
        document.getElementById('forexForm').style.display = 'block';
        this.populateBankSelects();
        document.getElementById('fxRate').value = LBTRData.exchangeRates.reference.toFixed(3);
    },

    hideForexForm: function() {
        document.getElementById('forexForm').style.display = 'none';
        document.getElementById('newForexForm').reset();
    },

    updateForexCalc: function() {
        var amount = parseFloat(document.getElementById('fxAmountUSD').value) || 0;
        var rate = parseFloat(document.getElementById('fxRate').value) || 0;
        var pen = (amount * rate).toFixed(2);
        document.getElementById('fxAmountPEN').value = 'S/ ' + LBTREngine.formatNumber(parseFloat(pen));
    },

    submitForex: function() {
        var data = {
            type: document.getElementById('fxType').value,
            buyer: document.getElementById('fxBuyer').value,
            seller: document.getElementById('fxSeller').value,
            amountUSD: document.getElementById('fxAmountUSD').value,
            rate: document.getElementById('fxRate').value
        };

        var result = LBTREngine.processForexOperation(data);

        if (result.success) {
            this.hideForexForm();
            this.renderForex();
            this.showToast('Operacion Forex Liquidada',
                'Operacion ' + result.fxId + ' procesada con exito', 'success');
        } else {
            this.showToast('Error', result.reason, 'error');
        }
    },

    renderForex: function() {
        var fxStats = LBTREngine.getForexStats();
        document.getElementById('forexBuy').textContent = 'S/ ' + LBTRData.exchangeRates.buy.toFixed(3);
        document.getElementById('forexSell').textContent = 'S/ ' + LBTRData.exchangeRates.sell.toFixed(3);
        document.getElementById('forexOps').textContent = fxStats.operations;
        document.getElementById('forexVolume').textContent = '$ ' + LBTREngine.formatNumber(fxStats.volume);

        var tbody = document.getElementById('forexBody');
        tbody.innerHTML = '';

        for (var i = 0; i < LBTRData.forexOperations.length; i++) {
            var op = LBTRData.forexOperations[i];
            var row = '<tr>';
            row += '<td><strong>' + op.id + '</strong></td>';
            row += '<td>' + new Date(op.timestamp).toLocaleString('es-PE') + '</td>';
            row += '<td><span class="status-badge ' + (op.type === 'COMPRA' ? 'activo' : 'pendiente') + '">' + op.type + '</span></td>';
            row += '<td>' + op.buyer + '</td>';
            row += '<td>' + op.seller + '</td>';
            row += '<td class="amount">$ ' + LBTREngine.formatNumber(op.amountUSD) + '</td>';
            row += '<td>' + op.rate.toFixed(3) + '</td>';
            row += '<td class="amount">S/ ' + LBTREngine.formatNumber(op.amountPEN) + '</td>';
            row += '<td><span class="status-badge liquidada">' + op.status + '</span></td>';
            row += '</tr>';
            tbody.innerHTML += row;
        }

        if (LBTRData.forexOperations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:#94a3b8;">No hay operaciones registradas</td></tr>';
        }
    },

    generateReport: function() {
        var type = document.getElementById('reportType').value;
        var html = LBTREngine.generateReport(type);

        var titles = {
            diario: 'Reporte Diario de Operaciones',
            participante: 'Reporte por Participante',
            liquidez: 'Reporte de Liquidez',
            forex: 'Reporte de Moneda Extranjera',
            resumen: 'Resumen Ejecutivo'
        };

        document.getElementById('reportTitle').textContent = titles[type] || 'Reporte';
        document.getElementById('reportContent').innerHTML = html;
        document.getElementById('reportOutput').style.display = 'block';
    },

    printReport: function() {
        window.print();
    },

    renderAuditLog: function(filter) {
        var tbody = document.getElementById('auditBody');
        tbody.innerHTML = '';

        var logs = LBTRData.auditLog;
        if (filter) {
            logs = logs.filter(function(log) { return log.type === filter; });
        }

        var displayLogs = logs.slice(0, 100);
        for (var i = 0; i < displayLogs.length; i++) {
            var log = displayLogs[i];
            var row = '<tr>';
            row += '<td>' + new Date(log.timestamp).toLocaleString('es-PE') + '</td>';
            row += '<td><span class="status-badge en-cola">' + log.type + '</span></td>';
            row += '<td>' + log.user + '</td>';
            row += '<td>' + log.entity + '</td>';
            row += '<td>' + log.description + '</td>';
            row += '<td>' + log.ip + '</td>';
            row += '</tr>';
            tbody.innerHTML += row;
        }

        if (displayLogs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#94a3b8;">No hay registros de auditoria</td></tr>';
        }
    },

    filterAuditLog: function() {
        var filter = document.getElementById('auditFilter').value;
        this.renderAuditLog(filter);
    },

    showModal: function(title, bodyHtml) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = bodyHtml;
        document.getElementById('modalOverlay').classList.add('show');
    },

    closeModal: function() {
        document.getElementById('modalOverlay').classList.remove('show');
    },

    showToast: function(title, message, type) {
        var container = document.getElementById('toastContainer');
        var icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        var toast = document.createElement('div');
        toast.className = 'toast ' + (type || 'info');
        toast.innerHTML = '<i class="fas ' + (icons[type] || icons.info) + ' toast-icon"></i>' +
            '<div class="toast-content"><div class="toast-title">' + title + '</div>' +
            '<div class="toast-message">' + message + '</div></div>';

        container.appendChild(toast);

        setTimeout(function() {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(function() { toast.remove(); }, 300);
        }, 4000);
    },

    toggleNotifications: function() {
        var panel = document.getElementById('notificationPanel');
        panel.classList.toggle('open');

        if (panel.classList.contains('open')) {
            var list = document.getElementById('notifList');
            list.innerHTML = '';
            var notifs = LBTRData.notifications.slice(0, 20);
            for (var i = 0; i < notifs.length; i++) {
                var n = notifs[i];
                var icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
                var item = document.createElement('div');
                item.className = 'notif-item';
                item.innerHTML = '<i class="fas ' + (icons[n.type] || 'fa-bell') + '"></i>' +
                    '<div><strong>' + n.title + '</strong><br>' + n.message +
                    '<div class="notif-time">' + new Date(n.timestamp).toLocaleString('es-PE') + '</div></div>';
                list.appendChild(item);
            }

            if (notifs.length === 0) {
                list.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;">Sin notificaciones</div>';
            }
        }
    },

    updateNotificationBadge: function() {
        var unread = LBTRData.notifications.filter(function(n) { return !n.read; }).length;
        var badge = document.getElementById('notifBadge');
        badge.textContent = unread > 99 ? '99+' : unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';
    }
};

document.addEventListener('DOMContentLoaded', function() {
    LBTR.init();
});
