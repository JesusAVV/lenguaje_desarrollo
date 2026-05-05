/* ============================================
   SISTEMA LBTR - Datos y Modelos
   ============================================ */

const PARTICIPANTS = [
    {
        code: "BCRP",
        name: "Banco Central de Reserva del Peru",
        shortName: "BCRP",
        type: "Administrador",
        connection: "Directa",
        status: "ACTIVO",
        joinDate: "2000-02-01",
        balancePEN: 999999999999.00,
        balanceUSD: 999999999.00,
        creditLimitPEN: 0
    },
    {
        code: "BCP",
        name: "Banco de Credito del Peru",
        shortName: "BCP",
        type: "Tipo I",
        connection: "SWIFT / Web",
        status: "ACTIVO",
        joinDate: "2000-02-01",
        balancePEN: 850000000.00,
        balanceUSD: 120000000.00,
        creditLimitPEN: 500000000.00
    },
    {
        code: "BBVA",
        name: "BBVA Peru",
        shortName: "BBVA",
        type: "Tipo I",
        connection: "SWIFT / Web",
        status: "ACTIVO",
        joinDate: "2000-02-01",
        balancePEN: 620000000.00,
        balanceUSD: 95000000.00,
        creditLimitPEN: 400000000.00
    },
    {
        code: "SCOTIABANK",
        name: "Scotiabank Peru",
        shortName: "Scotiabank",
        type: "Tipo I",
        connection: "SWIFT / Web",
        status: "ACTIVO",
        joinDate: "2000-02-01",
        balancePEN: 480000000.00,
        balanceUSD: 78000000.00,
        creditLimitPEN: 350000000.00
    },
    {
        code: "INTERBANK",
        name: "Interbank",
        shortName: "Interbank",
        type: "Tipo I",
        connection: "SWIFT / Web",
        status: "ACTIVO",
        joinDate: "2000-02-01",
        balancePEN: 420000000.00,
        balanceUSD: 65000000.00,
        creditLimitPEN: 300000000.00
    },
    {
        code: "BANBIF",
        name: "Banco Interamericano de Finanzas",
        shortName: "BanBif",
        type: "Tipo II",
        connection: "Cliente Web",
        status: "ACTIVO",
        joinDate: "2001-06-15",
        balancePEN: 180000000.00,
        balanceUSD: 28000000.00,
        creditLimitPEN: 120000000.00
    },
    {
        code: "NACION",
        name: "Banco de la Nacion",
        shortName: "Bco. Nacion",
        type: "Tipo I",
        connection: "SWIFT / Web",
        status: "ACTIVO",
        joinDate: "2000-02-01",
        balancePEN: 950000000.00,
        balanceUSD: 45000000.00,
        creditLimitPEN: 0
    },
    {
        code: "PICHINCHA",
        name: "Banco Pichincha",
        shortName: "Pichincha",
        type: "Tipo II",
        connection: "Cliente Web",
        status: "ACTIVO",
        joinDate: "2003-03-10",
        balancePEN: 95000000.00,
        balanceUSD: 15000000.00,
        creditLimitPEN: 60000000.00
    },
    {
        code: "COMERCIO",
        name: "Banco de Comercio",
        shortName: "Bco. Comercio",
        type: "Tipo II",
        connection: "Cliente Web",
        status: "ACTIVO",
        joinDate: "2002-01-20",
        balancePEN: 55000000.00,
        balanceUSD: 8000000.00,
        creditLimitPEN: 30000000.00
    },
    {
        code: "GNB",
        name: "Banco GNB Peru",
        shortName: "GNB",
        type: "Tipo II",
        connection: "Cliente Web",
        status: "ACTIVO",
        joinDate: "2014-05-12",
        balancePEN: 72000000.00,
        balanceUSD: 11000000.00,
        creditLimitPEN: 40000000.00
    },
    {
        code: "MIBANCO",
        name: "MiBanco",
        shortName: "MiBanco",
        type: "Tipo II",
        connection: "Cliente Web",
        status: "ACTIVO",
        joinDate: "2005-08-22",
        balancePEN: 210000000.00,
        balanceUSD: 18000000.00,
        creditLimitPEN: 100000000.00
    },
    {
        code: "CITIBANK",
        name: "Citibank del Peru",
        shortName: "Citibank",
        type: "Tipo II",
        connection: "Cliente Web",
        status: "ACTIVO",
        joinDate: "2000-04-01",
        balancePEN: 145000000.00,
        balanceUSD: 55000000.00,
        creditLimitPEN: 80000000.00
    }
];

const OPERATION_TYPES = {
    TRANSFER: "Transferencia",
    FX: "Compra-Venta M.E.",
    VALORES: "Liquidacion Valores",
    REPO: "Repo Intradia"
};

const STATUS_LABELS = {
    LIQUIDADA: { text: "Liquidada", class: "badge-success" },
    EN_COLA: { text: "En Cola", class: "badge-warning" },
    RECHAZADA: { text: "Rechazada", class: "badge-danger" },
    PROCESANDO: { text: "Procesando", class: "badge-info" },
    ACTIVO: { text: "Activo", class: "badge-success" },
    DEVUELTO: { text: "Devuelto", class: "badge-neutral" }
};

const VALOR_TYPES = {
    BONO_SOBERANO: "Bonos Soberanos",
    LETRA_TESORO: "Letras del Tesoro",
    CD_BCRP: "CD BCRP",
    BONO_CORPORATIVO: "Bonos Corporativos",
    ACCION: "Acciones BVL"
};

const COLLATERAL_TYPES = {
    CD_BCRP: "CD BCRP",
    BONO_SOBERANO: "Bonos Soberanos",
    LETRA_TESORO: "Letras del Tesoro"
};
