/* =====================================================
   Sistema LBTR - Capa de Datos
   Datos iniciales, participantes, y almacenamiento
   ===================================================== */

const LBTRData = {
    participants: [
        {
            code: 'BCRP',
            name: 'Banco Central de Reserva del Peru',
            shortName: 'BCRP',
            ruc: '20100030595',
            type: 'REGULADOR',
            balancePEN: 500000000.00,
            balanceUSD: 150000000.00,
            creditLine: 0,
            status: 'ACTIVO',
            joinDate: '2000-02-01'
        },
        {
            code: 'BCP',
            name: 'Banco de Credito del Peru',
            shortName: 'BCP',
            ruc: '20100047218',
            type: 'BANCA_MULTIPLE',
            balancePEN: 85000000.00,
            balanceUSD: 32000000.00,
            creditLine: 50000000.00,
            status: 'ACTIVO',
            joinDate: '2000-02-01'
        },
        {
            code: 'BBVA',
            name: 'BBVA Peru',
            shortName: 'BBVA',
            ruc: '20100023352',
            type: 'BANCA_MULTIPLE',
            balancePEN: 72000000.00,
            balanceUSD: 28000000.00,
            creditLine: 45000000.00,
            status: 'ACTIVO',
            joinDate: '2000-02-01'
        },
        {
            code: 'IBK',
            name: 'Interbank',
            shortName: 'Interbank',
            ruc: '20100053455',
            type: 'BANCA_MULTIPLE',
            balancePEN: 58000000.00,
            balanceUSD: 22000000.00,
            creditLine: 35000000.00,
            status: 'ACTIVO',
            joinDate: '2000-02-01'
        },
        {
            code: 'SBN',
            name: 'Scotiabank Peru',
            shortName: 'Scotiabank',
            ruc: '20100043140',
            type: 'BANCA_MULTIPLE',
            balancePEN: 62000000.00,
            balanceUSD: 25000000.00,
            creditLine: 40000000.00,
            status: 'ACTIVO',
            joinDate: '2000-02-01'
        },
        {
            code: 'BIF',
            name: 'Banco Interamericano de Finanzas',
            shortName: 'BanBif',
            ruc: '20101036813',
            type: 'BANCA_MULTIPLE',
            balancePEN: 18000000.00,
            balanceUSD: 7000000.00,
            creditLine: 12000000.00,
            status: 'ACTIVO',
            joinDate: '2001-06-15'
        },
        {
            code: 'MBK',
            name: 'Mibanco',
            shortName: 'Mibanco',
            ruc: '20382036655',
            type: 'BANCA_MULTIPLE',
            balancePEN: 15000000.00,
            balanceUSD: 5000000.00,
            creditLine: 10000000.00,
            status: 'ACTIVO',
            joinDate: '2005-03-20'
        },
        {
            code: 'PICHINCHA',
            name: 'Banco Pichincha',
            shortName: 'Pichincha',
            ruc: '20517476405',
            type: 'BANCA_MULTIPLE',
            balancePEN: 8000000.00,
            balanceUSD: 3000000.00,
            creditLine: 5000000.00,
            status: 'ACTIVO',
            joinDate: '2008-11-10'
        },
        {
            code: 'BANBIF',
            name: 'Banco GNB Peru',
            shortName: 'GNB',
            ruc: '20509507199',
            type: 'BANCA_MULTIPLE',
            balancePEN: 6000000.00,
            balanceUSD: 2500000.00,
            creditLine: 4000000.00,
            status: 'ACTIVO',
            joinDate: '2014-01-15'
        },
        {
            code: 'FALABELLA',
            name: 'Banco Falabella Peru',
            shortName: 'Falabella',
            ruc: '20330401991',
            type: 'BANCA_MULTIPLE',
            balancePEN: 5000000.00,
            balanceUSD: 2000000.00,
            creditLine: 3000000.00,
            status: 'ACTIVO',
            joinDate: '2010-07-01'
        }
    ],

    transactions: [],
    forexOperations: [],
    liquidityOps: [],
    auditLog: [],
    notifications: [],
    queue: [],

    exchangeRates: {
        buy: 3.720,
        sell: 3.760,
        reference: 3.740,
        lastUpdate: new Date().toISOString()
    },

    systemConfig: {
        operatingHours: { start: '09:00', end: '17:30' },
        maxTransferAmount: 999999999.99,
        minTransferAmount: 1.00,
        queueProcessInterval: 30000,
        autoProcessQueue: true
    },

    txIdCounter: 1000,
    fxIdCounter: 500,

    generateTxId: function() {
        this.txIdCounter++;
        return 'LBTR-' + String(this.txIdCounter).padStart(6, '0');
    },

    generateFxId: function() {
        this.fxIdCounter++;
        return 'FX-' + String(this.fxIdCounter).padStart(5, '0');
    },

    getParticipant: function(code) {
        return this.participants.find(function(p) { return p.code === code; });
    },

    getActiveParticipants: function() {
        return this.participants.filter(function(p) { return p.status === 'ACTIVO'; });
    },

    save: function() {
        try {
            localStorage.setItem('lbtr_participants', JSON.stringify(this.participants));
            localStorage.setItem('lbtr_transactions', JSON.stringify(this.transactions));
            localStorage.setItem('lbtr_forex', JSON.stringify(this.forexOperations));
            localStorage.setItem('lbtr_liquidity', JSON.stringify(this.liquidityOps));
            localStorage.setItem('lbtr_audit', JSON.stringify(this.auditLog));
            localStorage.setItem('lbtr_notifications', JSON.stringify(this.notifications));
            localStorage.setItem('lbtr_queue', JSON.stringify(this.queue));
            localStorage.setItem('lbtr_txCounter', this.txIdCounter);
            localStorage.setItem('lbtr_fxCounter', this.fxIdCounter);
            localStorage.setItem('lbtr_rates', JSON.stringify(this.exchangeRates));
        } catch (e) {
            console.warn('Error guardando datos:', e);
        }
    },

    load: function() {
        try {
            var p = localStorage.getItem('lbtr_participants');
            if (p) this.participants = JSON.parse(p);
            var t = localStorage.getItem('lbtr_transactions');
            if (t) this.transactions = JSON.parse(t);
            var f = localStorage.getItem('lbtr_forex');
            if (f) this.forexOperations = JSON.parse(f);
            var l = localStorage.getItem('lbtr_liquidity');
            if (l) this.liquidityOps = JSON.parse(l);
            var a = localStorage.getItem('lbtr_audit');
            if (a) this.auditLog = JSON.parse(a);
            var n = localStorage.getItem('lbtr_notifications');
            if (n) this.notifications = JSON.parse(n);
            var q = localStorage.getItem('lbtr_queue');
            if (q) this.queue = JSON.parse(q);
            var tc = localStorage.getItem('lbtr_txCounter');
            if (tc) this.txIdCounter = parseInt(tc);
            var fc = localStorage.getItem('lbtr_fxCounter');
            if (fc) this.fxIdCounter = parseInt(fc);
            var r = localStorage.getItem('lbtr_rates');
            if (r) this.exchangeRates = JSON.parse(r);
        } catch (e) {
            console.warn('Error cargando datos:', e);
        }
    },

    reset: function() {
        localStorage.removeItem('lbtr_participants');
        localStorage.removeItem('lbtr_transactions');
        localStorage.removeItem('lbtr_forex');
        localStorage.removeItem('lbtr_liquidity');
        localStorage.removeItem('lbtr_audit');
        localStorage.removeItem('lbtr_notifications');
        localStorage.removeItem('lbtr_queue');
        localStorage.removeItem('lbtr_txCounter');
        localStorage.removeItem('lbtr_fxCounter');
        localStorage.removeItem('lbtr_rates');
        location.reload();
    },

    generateSeedTransactions: function() {
        if (this.transactions.length > 0) return;

        var banks = ['BCP', 'BBVA', 'IBK', 'SBN', 'BIF', 'MBK'];
        var concepts = ['INTERBANCARIA', 'COMPENSACION', 'VALORES', 'PRESTAMO', 'ENCAJE'];
        var priorities = ['NORMAL', 'NORMAL', 'NORMAL', 'URGENTE', 'CRITICA'];
        var statuses = ['LIQUIDADA', 'LIQUIDADA', 'LIQUIDADA', 'LIQUIDADA', 'PENDIENTE', 'EN_COLA', 'RECHAZADA'];
        var now = new Date();

        for (var i = 0; i < 25; i++) {
            var sender = banks[Math.floor(Math.random() * banks.length)];
            var receiver;
            do {
                receiver = banks[Math.floor(Math.random() * banks.length)];
            } while (receiver === sender);

            var hour = 9 + Math.floor(Math.random() * 8);
            var minute = Math.floor(Math.random() * 60);
            var txTime = new Date(now);
            txTime.setHours(hour, minute, Math.floor(Math.random() * 60));

            var amount = Math.round((Math.random() * 5000000 + 10000) * 100) / 100;
            var status = statuses[Math.floor(Math.random() * statuses.length)];
            var priority = priorities[Math.floor(Math.random() * priorities.length)];

            this.transactions.push({
                id: this.generateTxId(),
                timestamp: txTime.toISOString(),
                sender: sender,
                receiver: receiver,
                currency: Math.random() > 0.2 ? 'PEN' : 'USD',
                amount: amount,
                concept: concepts[Math.floor(Math.random() * concepts.length)],
                priority: priority,
                status: status,
                reference: 'REF-' + String(Math.floor(Math.random() * 99999)).padStart(5, '0'),
                processedAt: status === 'LIQUIDADA' ? txTime.toISOString() : null,
                rejectReason: status === 'RECHAZADA' ? 'Fondos insuficientes' : null
            });
        }

        for (var j = 0; j < this.transactions.length; j++) {
            var tx = this.transactions[j];
            if (tx.status === 'EN_COLA' || tx.status === 'PENDIENTE') {
                this.queue.push({
                    txId: tx.id,
                    timestamp: tx.timestamp,
                    sender: tx.sender,
                    receiver: tx.receiver,
                    amount: tx.amount,
                    currency: tx.currency,
                    priority: tx.priority,
                    reason: 'Pendiente de liquidez suficiente'
                });
            }
        }

        this.auditLog.push({
            timestamp: new Date().toISOString(),
            type: 'SISTEMA',
            user: 'SYSTEM',
            entity: 'BCRP',
            description: 'Sistema LBTR iniciado - Datos de demo generados',
            ip: '10.0.0.1'
        });

        this.save();
    }
};
