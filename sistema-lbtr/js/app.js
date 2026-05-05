/* ============================================
   SISTEMA LBTR - Logica de Aplicacion
   ============================================ */

(function () {
    "use strict";

    // ---- State ----
    let currentUser = null;
    let transfers = [];
    let queue = [];
    let forexOps = [];
    let valoresOps = [];
    let repoOps = [];
    let allOperations = [];
    let operationCounter = 0;
    let systemLogs = [];
    let hourlyData = new Array(15).fill(0); // 06:00 to 20:00
    let participantBalances = {};
    let pendingModalAction = null;

    // ---- Helpers ----
    function generateId(prefix) {
        operationCounter++;
        const pad = String(operationCounter).padStart(6, "0");
        const date = new Date();
        const d = String(date.getDate()).padStart(2, "0") +
            String(date.getMonth() + 1).padStart(2, "0") +
            String(date.getFullYear()).toString().slice(-2);
        return prefix + d + "-" + pad;
    }

    function timeNow() {
        const d = new Date();
        return String(d.getHours()).padStart(2, "0") + ":" +
            String(d.getMinutes()).padStart(2, "0") + ":" +
            String(d.getSeconds()).padStart(2, "0");
    }

    function formatAmount(n) {
        return Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function getParticipant(code) {
        return PARTICIPANTS.find(function (p) { return p.code === code; });
    }

    function getBalance(code, currency) {
        var key = code + "_" + currency;
        if (participantBalances[key] !== undefined) return participantBalances[key];
        var p = getParticipant(code);
        if (!p) return 0;
        return currency === "PEN" ? p.balancePEN : p.balanceUSD;
    }

    function setBalance(code, currency, amount) {
        participantBalances[code + "_" + currency] = amount;
    }

    function getCreditLimit(code) {
        var key = code + "_CREDIT";
        if (participantBalances[key] !== undefined) return participantBalances[key];
        var p = getParticipant(code);
        return p ? p.creditLimitPEN : 0;
    }

    function getAvailablePEN(code) {
        return getBalance(code, "PEN") + getCreditLimit(code);
    }

    function statusBadge(status) {
        var s = STATUS_LABELS[status] || { text: status, class: "badge-neutral" };
        return '<span class="badge ' + s.class + '">' + s.text + '</span>';
    }

    function addLog(message, level) {
        level = level || "info";
        var entry = { time: timeNow(), message: message, level: level };
        systemLogs.unshift(entry);
        if (systemLogs.length > 200) systemLogs.pop();
        renderSystemLog();
    }

    function showToast(message, type) {
        type = type || "info";
        var icons = {
            success: "fas fa-check-circle",
            error: "fas fa-exclamation-circle",
            warning: "fas fa-exclamation-triangle",
            info: "fas fa-info-circle"
        };
        var container = document.getElementById("toastContainer");
        var toast = document.createElement("div");
        toast.className = "toast toast-" + type;
        toast.innerHTML = '<i class="' + (icons[type] || icons.info) + '"></i><span>' + message + '</span>';
        container.appendChild(toast);
        setTimeout(function () {
            toast.style.animation = "slideOutRight 0.4s ease forwards";
            setTimeout(function () { toast.remove(); }, 400);
        }, 4000);
    }

    function showModal(title, bodyHTML, onConfirm) {
        document.getElementById("modalTitle").textContent = title;
        document.getElementById("modalBody").innerHTML = bodyHTML;
        document.getElementById("confirmModal").style.display = "flex";
        pendingModalAction = onConfirm;
    }

    function hideModal() {
        document.getElementById("confirmModal").style.display = "none";
        pendingModalAction = null;
    }

    // ---- Clock ----
    function updateClock() {
        document.getElementById("systemClock").textContent = timeNow();
    }
    setInterval(updateClock, 1000);
    updateClock();

    // ---- Date display ----
    function setDateDisplay() {
        var d = new Date();
        var opts = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
        var el = document.getElementById("dashDate");
        if (el) el.textContent = d.toLocaleDateString("es-PE", opts);
    }
    setDateDisplay();

    // ---- Populate selects ----
    function populateEntitySelects() {
        var selects = ["txOrigin", "txDestination", "fxBuyer", "fxSeller",
            "valBuyer", "valSeller", "repoParticipant", "reportEntity"];
        selects.forEach(function (id) {
            var sel = document.getElementById(id);
            if (!sel) return;
            var firstOption = sel.querySelector("option");
            sel.innerHTML = "";
            if (firstOption) sel.appendChild(firstOption);
            PARTICIPANTS.forEach(function (p) {
                if (id === "repoParticipant" && p.code === "BCRP") return;
                var opt = document.createElement("option");
                opt.value = p.code;
                opt.textContent = p.shortName;
                sel.appendChild(opt);
            });
        });
    }

    // ---- Login ----
    document.getElementById("loginForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var entity = document.getElementById("loginEntity").value;
        var user = document.getElementById("loginUser").value;
        if (!entity) {
            showToast("Seleccione una entidad", "warning");
            return;
        }
        currentUser = {
            entity: entity,
            user: user,
            participant: getParticipant(entity)
        };

        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("mainApp").style.display = "flex";
        document.getElementById("navbarEntity").textContent = currentUser.participant.shortName;

        populateEntitySelects();
        renderParticipants();
        renderBalances();
        updateDashboard();
        renderHourlyChart();

        addLog("Sesion iniciada: " + currentUser.participant.name + " (" + user + ")", "success");
        addLog("Sistema LBTR operativo - Ciclo de liquidacion activo", "info");
        showToast("Bienvenido al Sistema LBTR, " + currentUser.participant.shortName, "success");
    });

    // ---- Logout ----
    document.getElementById("btnLogout").addEventListener("click", function () {
        addLog("Sesion cerrada: " + currentUser.participant.name, "warning");
        currentUser = null;
        document.getElementById("mainApp").style.display = "none";
        document.getElementById("loginScreen").style.display = "flex";
        document.getElementById("loginForm").reset();
    });

    // ---- Sidebar Navigation ----
    document.querySelectorAll(".nav-item").forEach(function (item) {
        item.addEventListener("click", function (e) {
            e.preventDefault();
            var section = this.getAttribute("data-section");
            document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
            this.classList.add("active");
            document.querySelectorAll(".content-section").forEach(function (s) { s.classList.remove("active"); });
            var target = document.getElementById("sec-" + section);
            if (target) target.classList.add("active");

            // Close sidebar on mobile
            if (window.innerWidth <= 768) {
                document.getElementById("sidebar").classList.remove("show-mobile");
            }
        });
    });

    // ---- Toggle Sidebar ----
    document.getElementById("toggleSidebar").addEventListener("click", function () {
        var sb = document.getElementById("sidebar");
        var mc = document.getElementById("mainContent");
        if (window.innerWidth <= 768) {
            sb.classList.toggle("show-mobile");
        } else {
            sb.classList.toggle("collapsed");
            mc.classList.toggle("expanded");
        }
    });

    // ---- TRANSFERENCIAS ----
    document.getElementById("transferForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var origin = document.getElementById("txOrigin").value;
        var dest = document.getElementById("txDestination").value;
        var amount = parseFloat(document.getElementById("txAmount").value);
        var currency = document.getElementById("txCurrency").value;
        var priority = document.getElementById("txPriority").value;
        var concept = document.getElementById("txConcept").value;

        if (origin === dest) {
            showToast("El ordenante y beneficiario no pueden ser la misma entidad", "error");
            return;
        }

        var originP = getParticipant(origin);
        var destP = getParticipant(dest);

        var bodyHTML =
            '<div class="detail-row"><span class="detail-label">Ordenante:</span><span class="detail-value">' + originP.shortName + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Beneficiario:</span><span class="detail-value">' + destP.shortName + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Monto:</span><span class="detail-value">' + (currency === "PEN" ? "S/ " : "$ ") + formatAmount(amount) + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Moneda:</span><span class="detail-value">' + currency + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Prioridad:</span><span class="detail-value">' + priority + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Concepto:</span><span class="detail-value">' + concept + '</span></div>';

        showModal("Confirmar Transferencia", bodyHTML, function () {
            processTransfer(origin, dest, amount, currency, priority, concept);
        });
    });

    function processTransfer(origin, dest, amount, currency, priority, concept) {
        var id = generateId("TRF");
        var originBalance = getBalance(origin, currency);
        var available = currency === "PEN" ? getAvailablePEN(origin) : originBalance;
        var status;

        if (available >= amount) {
            // Settle immediately
            setBalance(origin, currency, getBalance(origin, currency) - amount);
            setBalance(dest, currency, getBalance(dest, currency) + amount);
            status = "LIQUIDADA";
            addLog("Transferencia " + id + " liquidada: " + getParticipant(origin).shortName + " -> " + getParticipant(dest).shortName + " " + (currency === "PEN" ? "S/" : "$") + " " + formatAmount(amount), "success");
            showToast("Transferencia " + id + " liquidada exitosamente", "success");
        } else {
            status = "EN_COLA";
            addLog("Transferencia " + id + " enviada a cola: fondos insuficientes en " + getParticipant(origin).shortName, "warning");
            showToast("Transferencia " + id + " enviada a cola de espera (fondos insuficientes)", "warning");
        }

        var op = {
            id: id,
            type: "TRANSFER",
            time: timeNow(),
            origin: origin,
            destination: dest,
            amount: amount,
            currency: currency,
            priority: priority,
            concept: concept,
            status: status
        };

        transfers.push(op);
        allOperations.push(op);

        if (status === "EN_COLA") {
            queue.push(op);
        }

        // Update hourly data
        var hour = new Date().getHours();
        if (hour >= 6 && hour <= 20) {
            hourlyData[hour - 6]++;
        }

        renderTransfers();
        renderQueue();
        renderBalances();
        updateDashboard();
        renderHourlyChart();
        document.getElementById("transferForm").reset();
    }

    // ---- FOREX ----
    document.getElementById("fxAmountUSD").addEventListener("input", calcFXPEN);
    document.getElementById("fxRate").addEventListener("input", calcFXPEN);

    function calcFXPEN() {
        var usd = parseFloat(document.getElementById("fxAmountUSD").value) || 0;
        var rate = parseFloat(document.getElementById("fxRate").value) || 0;
        document.getElementById("fxAmountPEN").value = "S/ " + formatAmount(usd * rate);
    }

    document.getElementById("forexForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var type = document.getElementById("fxType").value;
        var buyer = document.getElementById("fxBuyer").value;
        var seller = document.getElementById("fxSeller").value;
        var amountUSD = parseFloat(document.getElementById("fxAmountUSD").value);
        var rate = parseFloat(document.getElementById("fxRate").value);
        var amountPEN = amountUSD * rate;

        if (buyer === seller) {
            showToast("El comprador y vendedor no pueden ser la misma entidad", "error");
            return;
        }

        var buyerP = getParticipant(buyer);
        var sellerP = getParticipant(seller);

        var bodyHTML =
            '<div class="detail-row"><span class="detail-label">Tipo:</span><span class="detail-value">' + type + ' USD</span></div>' +
            '<div class="detail-row"><span class="detail-label">Comprador:</span><span class="detail-value">' + buyerP.shortName + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Vendedor:</span><span class="detail-value">' + sellerP.shortName + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Monto USD:</span><span class="detail-value">$ ' + formatAmount(amountUSD) + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Tipo Cambio:</span><span class="detail-value">' + rate.toFixed(4) + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Monto PEN:</span><span class="detail-value">S/ ' + formatAmount(amountPEN) + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Mecanismo:</span><span class="detail-value">Pago contra Pago (PvP)</span></div>';

        showModal("Confirmar Operacion FX", bodyHTML, function () {
            processFX(type, buyer, seller, amountUSD, rate, amountPEN);
        });
    });

    function processFX(type, buyer, seller, amountUSD, rate, amountPEN) {
        var id = generateId("FX");

        // PvP: buyer pays PEN, receives USD; seller pays USD, receives PEN
        var buyerPEN = getBalance(buyer, "PEN");
        var sellerUSD = getBalance(seller, "USD");
        var status;

        if (buyerPEN >= amountPEN && sellerUSD >= amountUSD) {
            setBalance(buyer, "PEN", buyerPEN - amountPEN);
            setBalance(buyer, "USD", getBalance(buyer, "USD") + amountUSD);
            setBalance(seller, "USD", sellerUSD - amountUSD);
            setBalance(seller, "PEN", getBalance(seller, "PEN") + amountPEN);
            status = "LIQUIDADA";
            addLog("Operacion FX " + id + " liquidada (PvP): " + getParticipant(buyer).shortName + " compra $ " + formatAmount(amountUSD) + " a " + getParticipant(seller).shortName + " @ " + rate.toFixed(4), "success");
            showToast("Operacion FX " + id + " liquidada exitosamente (PvP)", "success");
        } else {
            status = "RECHAZADA";
            addLog("Operacion FX " + id + " rechazada: fondos insuficientes para PvP", "error");
            showToast("Operacion FX " + id + " rechazada por fondos insuficientes", "error");
        }

        var op = {
            id: id,
            type: "FX",
            time: timeNow(),
            fxType: type,
            buyer: buyer,
            seller: seller,
            amountUSD: amountUSD,
            rate: rate,
            amountPEN: amountPEN,
            currency: "USD/PEN",
            status: status
        };

        forexOps.push(op);
        allOperations.push(op);

        var hour = new Date().getHours();
        if (hour >= 6 && hour <= 20) hourlyData[hour - 6]++;

        renderForex();
        renderBalances();
        updateDashboard();
        renderHourlyChart();
        document.getElementById("forexForm").reset();
        document.getElementById("fxAmountPEN").value = "";
    }

    // ---- VALORES ----
    document.getElementById("valoresForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var type = document.getElementById("valType").value;
        var buyer = document.getElementById("valBuyer").value;
        var seller = document.getElementById("valSeller").value;
        var isin = document.getElementById("valISIN").value;
        var nominal = parseFloat(document.getElementById("valNominal").value);
        var currency = document.getElementById("valCurrency").value;

        if (buyer === seller) {
            showToast("El comprador y vendedor no pueden ser la misma entidad", "error");
            return;
        }

        var bodyHTML =
            '<div class="detail-row"><span class="detail-label">Tipo Valor:</span><span class="detail-value">' + VALOR_TYPES[type] + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">ISIN:</span><span class="detail-value">' + isin + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Comprador:</span><span class="detail-value">' + getParticipant(buyer).shortName + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Vendedor:</span><span class="detail-value">' + getParticipant(seller).shortName + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Nominal:</span><span class="detail-value">' + (currency === "PEN" ? "S/ " : "$ ") + formatAmount(nominal) + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Liquidacion:</span><span class="detail-value">Entrega contra Pago (DvP)</span></div>';

        showModal("Confirmar Liquidacion de Valores", bodyHTML, function () {
            processValores(type, buyer, seller, isin, nominal, currency);
        });
    });

    function processValores(type, buyer, seller, isin, nominal, currency) {
        var id = generateId("VAL");
        var buyerBal = getBalance(buyer, currency);
        var status;

        if (buyerBal >= nominal) {
            setBalance(buyer, currency, buyerBal - nominal);
            setBalance(seller, currency, getBalance(seller, currency) + nominal);
            status = "LIQUIDADA";
            addLog("Liquidacion valores " + id + " completada (DvP): " + VALOR_TYPES[type] + " " + isin, "success");
            showToast("Liquidacion " + id + " completada exitosamente", "success");
        } else {
            status = "RECHAZADA";
            addLog("Liquidacion valores " + id + " rechazada: fondos insuficientes en " + getParticipant(buyer).shortName, "error");
            showToast("Liquidacion " + id + " rechazada por fondos insuficientes", "error");
        }

        var op = {
            id: id,
            type: "VALORES",
            time: timeNow(),
            valorType: type,
            isin: isin,
            buyer: buyer,
            seller: seller,
            nominal: nominal,
            currency: currency,
            status: status
        };

        valoresOps.push(op);
        allOperations.push(op);

        var hour = new Date().getHours();
        if (hour >= 6 && hour <= 20) hourlyData[hour - 6]++;

        renderValores();
        renderBalances();
        updateDashboard();
        renderHourlyChart();
        document.getElementById("valoresForm").reset();
    }

    // ---- REPO INTRADIA ----
    document.getElementById("repoForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var participant = document.getElementById("repoParticipant").value;
        var collateral = document.getElementById("repoCollateral").value;
        var amount = parseFloat(document.getElementById("repoAmount").value);
        var collateralValue = parseFloat(document.getElementById("repoCollateralValue").value);
        var haircut = 5.0;

        var requiredCollateral = amount * (1 + haircut / 100);

        if (collateralValue < requiredCollateral) {
            showToast("El valor de la garantia debe ser al menos S/ " + formatAmount(requiredCollateral) + " (monto + haircut " + haircut + "%)", "error");
            return;
        }

        var bodyHTML =
            '<div class="detail-row"><span class="detail-label">Participante:</span><span class="detail-value">' + getParticipant(participant).shortName + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Monto Solicitado:</span><span class="detail-value">S/ ' + formatAmount(amount) + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Garantia:</span><span class="detail-value">' + COLLATERAL_TYPES[collateral] + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Valor Garantia:</span><span class="detail-value">S/ ' + formatAmount(collateralValue) + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Haircut:</span><span class="detail-value">' + haircut.toFixed(2) + '%</span></div>' +
            '<div class="detail-row"><span class="detail-label">Devolucion:</span><span class="detail-value">Antes del cierre (20:30 hrs)</span></div>';

        showModal("Confirmar Repo Intradia", bodyHTML, function () {
            processRepo(participant, collateral, amount, collateralValue);
        });
    });

    function processRepo(participant, collateral, amount, collateralValue) {
        var id = generateId("RPO");

        // Credit participant with PEN (liquidity injection from BCRP)
        setBalance(participant, "PEN", getBalance(participant, "PEN") + amount);

        var op = {
            id: id,
            type: "REPO",
            time: timeNow(),
            participant: participant,
            collateral: collateral,
            amount: amount,
            collateralValue: collateralValue,
            status: "ACTIVO"
        };

        repoOps.push(op);
        allOperations.push(op);

        addLog("Repo intradia " + id + " aprobado: BCRP otorga S/ " + formatAmount(amount) + " a " + getParticipant(participant).shortName + " con garantia " + COLLATERAL_TYPES[collateral], "success");
        showToast("Repo " + id + " aprobado. Liquidez otorgada: S/ " + formatAmount(amount), "success");

        var hour = new Date().getHours();
        if (hour >= 6 && hour <= 20) hourlyData[hour - 6]++;

        renderRepos();
        renderBalances();
        updateDashboard();
        renderHourlyChart();
        document.getElementById("repoForm").reset();
    }

    function returnRepo(repoId) {
        var repo = repoOps.find(function (r) { return r.id === repoId; });
        if (!repo || repo.status !== "ACTIVO") return;

        var currentBal = getBalance(repo.participant, "PEN");
        if (currentBal < repo.amount) {
            showToast("Fondos insuficientes para devolver el repo " + repoId, "error");
            return;
        }

        setBalance(repo.participant, "PEN", currentBal - repo.amount);
        repo.status = "DEVUELTO";

        addLog("Repo intradia " + repoId + " devuelto: " + getParticipant(repo.participant).shortName + " devuelve S/ " + formatAmount(repo.amount) + " al BCRP", "info");
        showToast("Repo " + repoId + " devuelto exitosamente", "success");

        renderRepos();
        renderBalances();
        updateDashboard();
    }

    // ---- QUEUE PROCESSING ----
    document.getElementById("btnProcessQueue").addEventListener("click", function () {
        if (queue.length === 0) {
            showToast("La cola de espera esta vacia", "info");
            return;
        }
        processQueue();
    });

    document.getElementById("btnClearQueue").addEventListener("click", function () {
        if (queue.length === 0) {
            showToast("La cola de espera esta vacia", "info");
            return;
        }
        showModal("Cancelar operaciones en cola", "<p>Se cancelaran <strong>" + queue.length + "</strong> operaciones en cola. Esta accion no se puede deshacer.</p>", function () {
            queue.forEach(function (op) {
                op.status = "RECHAZADA";
                addLog("Operacion " + op.id + " cancelada de la cola", "warning");
            });
            queue = [];
            renderQueue();
            renderTransfers();
            updateDashboard();
            showToast("Todas las operaciones en cola han sido canceladas", "warning");
        });
    });

    function processQueue() {
        var processed = 0;
        var remaining = [];

        // Sort by priority (URGENTE first)
        queue.sort(function (a, b) {
            if (a.priority === "URGENTE" && b.priority !== "URGENTE") return -1;
            if (a.priority !== "URGENTE" && b.priority === "URGENTE") return 1;
            return 0;
        });

        queue.forEach(function (op) {
            var available = op.currency === "PEN" ? getAvailablePEN(op.origin) : getBalance(op.origin, op.currency);
            if (available >= op.amount) {
                setBalance(op.origin, op.currency, getBalance(op.origin, op.currency) - op.amount);
                setBalance(op.destination, op.currency, getBalance(op.destination, op.currency) + op.amount);
                op.status = "LIQUIDADA";
                processed++;
                addLog("Cola: " + op.id + " liquidada tras reprocesamiento", "success");
            } else {
                remaining.push(op);
            }
        });

        queue = remaining;
        renderQueue();
        renderTransfers();
        renderBalances();
        updateDashboard();

        if (processed > 0) {
            showToast(processed + " operacion(es) liquidada(s) desde la cola", "success");
        } else {
            showToast("No se pudieron liquidar operaciones (fondos insuficientes)", "warning");
        }
    }

    function cancelQueueItem(opId) {
        var idx = queue.findIndex(function (q) { return q.id === opId; });
        if (idx === -1) return;
        queue[idx].status = "RECHAZADA";
        queue.splice(idx, 1);
        addLog("Operacion " + opId + " cancelada de la cola", "warning");
        showToast("Operacion " + opId + " cancelada", "warning");
        renderQueue();
        renderTransfers();
        updateDashboard();
    }

    // ---- REPORTES ----
    document.getElementById("btnGenReport").addEventListener("click", function () {
        var typeFilter = document.getElementById("reportType").value;
        var statusFilter = document.getElementById("reportStatus").value;
        var entityFilter = document.getElementById("reportEntity").value;

        var filtered = allOperations.filter(function (op) {
            if (typeFilter !== "ALL" && op.type !== typeFilter) return false;
            if (statusFilter !== "ALL" && op.status !== statusFilter) return false;
            if (entityFilter !== "ALL") {
                var entities = [op.origin, op.destination, op.buyer, op.seller, op.participant].filter(Boolean);
                if (entities.indexOf(entityFilter) === -1) return false;
            }
            return true;
        });

        renderReport(filtered);
    });

    document.getElementById("btnExportReport").addEventListener("click", function () {
        var rows = document.querySelectorAll("#reportList tr");
        if (rows.length === 0 || (rows.length === 1 && rows[0].querySelector(".empty-msg"))) {
            showToast("No hay datos para exportar", "warning");
            return;
        }
        var csv = "ID,Tipo,Hora,Origen,Destino,Monto,Moneda,Estado\n";
        rows.forEach(function (row) {
            var cells = row.querySelectorAll("td");
            if (cells.length > 1) {
                var line = [];
                cells.forEach(function (c) { line.push('"' + c.textContent.trim() + '"'); });
                csv += line.join(",") + "\n";
            }
        });

        var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        var link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "reporte_lbtr_" + new Date().toISOString().slice(0, 10) + ".csv";
        link.click();
        showToast("Reporte exportado exitosamente", "success");
    });

    // ---- RENDER FUNCTIONS ----
    function updateDashboard() {
        var settled = allOperations.filter(function (o) { return o.status === "LIQUIDADA"; }).length;
        var queued = queue.length;
        var rejected = allOperations.filter(function (o) { return o.status === "RECHAZADA"; }).length;
        var totalPEN = allOperations.filter(function (o) { return o.status === "LIQUIDADA"; }).reduce(function (sum, o) {
            if (o.type === "FX") return sum + o.amountPEN;
            if (o.currency === "PEN") return sum + (o.amount || o.nominal || 0);
            return sum;
        }, 0);
        var fxCount = forexOps.length;

        document.getElementById("statTransfers").textContent = allOperations.length;
        document.getElementById("statSettled").textContent = settled;
        document.getElementById("statQueued").textContent = queued;
        document.getElementById("statTotalAmount").textContent = formatAmount(totalPEN);
        document.getElementById("statFX").textContent = fxCount;
        document.getElementById("statRejected").textContent = rejected;

        // Monitor stats
        document.getElementById("monProcessed").textContent = allOperations.length;
        var volPEN = allOperations.reduce(function (s, o) {
            if (o.currency === "PEN" && o.status === "LIQUIDADA") return s + (o.amount || o.nominal || 0);
            if (o.type === "FX" && o.status === "LIQUIDADA") return s + o.amountPEN;
            return s;
        }, 0);
        var volUSD = allOperations.reduce(function (s, o) {
            if (o.currency === "USD" && o.status === "LIQUIDADA") return s + (o.amount || o.nominal || 0);
            if (o.type === "FX" && o.status === "LIQUIDADA") return s + o.amountUSD;
            return s;
        }, 0);
        document.getElementById("monVolumePEN").textContent = "S/ " + formatAmount(volPEN);
        document.getElementById("monVolumeUSD").textContent = "$ " + formatAmount(volUSD);

        var total = allOperations.length;
        var settleRate = total > 0 ? ((settled / total) * 100).toFixed(1) : "0";
        document.getElementById("monSettleRate").textContent = settleRate + "%";
        document.getElementById("monConnected").textContent = currentUser ? "1" : "0";
        document.getElementById("monLastBackup").textContent = timeNow();

        // Recent ops in dashboard
        renderDashRecentOps();
    }

    function renderDashRecentOps() {
        var tbody = document.getElementById("dashRecentOps");
        var recent = allOperations.slice(-10).reverse();
        if (recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">No hay operaciones registradas</td></tr>';
            return;
        }
        tbody.innerHTML = recent.map(function (op) {
            var origin = op.origin || op.buyer || op.participant || "--";
            var dest = op.destination || op.seller || "BCRP";
            var amount = op.amount || op.amountUSD || op.nominal || 0;
            var currency = op.currency || "PEN";
            var symbol = currency === "PEN" ? "S/ " : currency === "USD" ? "$ " : "";
            var originP = getParticipant(origin);
            var destP = getParticipant(dest);
            return '<tr>' +
                '<td>' + op.time + '</td>' +
                '<td>' + (originP ? originP.shortName : origin) + '</td>' +
                '<td>' + (destP ? destP.shortName : dest) + '</td>' +
                '<td class="text-right">' + symbol + formatAmount(amount) + '</td>' +
                '<td>' + currency + '</td>' +
                '<td>' + statusBadge(op.status) + '</td>' +
                '</tr>';
        }).join("");
    }

    function renderTransfers() {
        var tbody = document.getElementById("transferList");
        if (transfers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">No hay transferencias registradas</td></tr>';
            return;
        }
        tbody.innerHTML = transfers.slice().reverse().map(function (op) {
            var symbol = op.currency === "PEN" ? "S/ " : "$ ";
            return '<tr>' +
                '<td><strong>' + op.id + '</strong></td>' +
                '<td>' + op.time + '</td>' +
                '<td>' + getParticipant(op.origin).shortName + '</td>' +
                '<td>' + getParticipant(op.destination).shortName + '</td>' +
                '<td class="text-right">' + symbol + formatAmount(op.amount) + '</td>' +
                '<td>' + op.currency + '</td>' +
                '<td>' + op.priority + '</td>' +
                '<td>' + statusBadge(op.status) + '</td>' +
                '</tr>';
        }).join("");
    }

    function renderQueue() {
        var tbody = document.getElementById("queueList");
        if (queue.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-msg">La cola de espera esta vacia</td></tr>';
            return;
        }
        tbody.innerHTML = queue.map(function (op, i) {
            var symbol = op.currency === "PEN" ? "S/ " : "$ ";
            return '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td><strong>' + op.id + '</strong></td>' +
                '<td>' + op.time + '</td>' +
                '<td>' + getParticipant(op.origin).shortName + '</td>' +
                '<td>' + getParticipant(op.destination).shortName + '</td>' +
                '<td class="text-right">' + symbol + formatAmount(op.amount) + '</td>' +
                '<td>' + op.currency + '</td>' +
                '<td>' + op.priority + '</td>' +
                '<td><button class="btn btn-sm btn-danger" onclick="window._cancelQueueItem(\'' + op.id + '\')"><i class="fas fa-times"></i> Cancelar</button></td>' +
                '</tr>';
        }).join("");
    }

    // Expose cancel function globally
    window._cancelQueueItem = cancelQueueItem;
    window._returnRepo = returnRepo;

    function renderBalances() {
        var tbody = document.getElementById("balanceList");
        tbody.innerHTML = PARTICIPANTS.map(function (p) {
            var balPEN = getBalance(p.code, "PEN");
            var balUSD = getBalance(p.code, "USD");
            var credit = getCreditLimit(p.code);
            var available = balPEN + credit;
            return '<tr>' +
                '<td><strong>' + p.code + '</strong></td>' +
                '<td>' + p.name + '</td>' +
                '<td class="text-right">S/ ' + formatAmount(balPEN) + '</td>' +
                '<td class="text-right">$ ' + formatAmount(balUSD) + '</td>' +
                '<td class="text-right">S/ ' + formatAmount(credit) + '</td>' +
                '<td class="text-right"><strong>S/ ' + formatAmount(available) + '</strong></td>' +
                '<td>' + statusBadge("ACTIVO") + '</td>' +
                '</tr>';
        }).join("");
    }

    function renderForex() {
        var tbody = document.getElementById("forexList");
        if (forexOps.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-msg">No hay operaciones FX registradas</td></tr>';
            return;
        }
        tbody.innerHTML = forexOps.slice().reverse().map(function (op) {
            return '<tr>' +
                '<td><strong>' + op.id + '</strong></td>' +
                '<td>' + op.time + '</td>' +
                '<td>' + op.fxType + '</td>' +
                '<td>' + getParticipant(op.buyer).shortName + '</td>' +
                '<td>' + getParticipant(op.seller).shortName + '</td>' +
                '<td class="text-right">$ ' + formatAmount(op.amountUSD) + '</td>' +
                '<td>' + op.rate.toFixed(4) + '</td>' +
                '<td class="text-right">S/ ' + formatAmount(op.amountPEN) + '</td>' +
                '<td>' + statusBadge(op.status) + '</td>' +
                '</tr>';
        }).join("");
    }

    function renderValores() {
        var tbody = document.getElementById("valoresList");
        if (valoresOps.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-msg">No hay liquidaciones de valores registradas</td></tr>';
            return;
        }
        tbody.innerHTML = valoresOps.slice().reverse().map(function (op) {
            var symbol = op.currency === "PEN" ? "S/ " : "$ ";
            return '<tr>' +
                '<td><strong>' + op.id + '</strong></td>' +
                '<td>' + op.time + '</td>' +
                '<td>' + VALOR_TYPES[op.valorType] + '</td>' +
                '<td>' + op.isin + '</td>' +
                '<td>' + getParticipant(op.buyer).shortName + '</td>' +
                '<td>' + getParticipant(op.seller).shortName + '</td>' +
                '<td class="text-right">' + symbol + formatAmount(op.nominal) + '</td>' +
                '<td>' + op.currency + '</td>' +
                '<td>' + statusBadge(op.status) + '</td>' +
                '</tr>';
        }).join("");
    }

    function renderRepos() {
        var tbody = document.getElementById("repoList");
        if (repoOps.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">No hay repos activos</td></tr>';
            return;
        }
        tbody.innerHTML = repoOps.slice().reverse().map(function (op) {
            var actionBtn = op.status === "ACTIVO"
                ? '<button class="btn btn-sm btn-primary" onclick="window._returnRepo(\'' + op.id + '\')"><i class="fas fa-undo"></i> Devolver</button>'
                : "--";
            return '<tr>' +
                '<td><strong>' + op.id + '</strong></td>' +
                '<td>' + op.time + '</td>' +
                '<td>' + getParticipant(op.participant).shortName + '</td>' +
                '<td class="text-right">S/ ' + formatAmount(op.amount) + '</td>' +
                '<td>' + COLLATERAL_TYPES[op.collateral] + '</td>' +
                '<td class="text-right">S/ ' + formatAmount(op.collateralValue) + '</td>' +
                '<td>' + statusBadge(op.status) + '</td>' +
                '<td>' + actionBtn + '</td>' +
                '</tr>';
        }).join("");
    }

    function renderReport(data) {
        var tbody = document.getElementById("reportList");
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">No se encontraron operaciones con los filtros seleccionados</td></tr>';
            return;
        }
        tbody.innerHTML = data.slice().reverse().map(function (op) {
            var origin = op.origin || op.buyer || op.participant || "--";
            var dest = op.destination || op.seller || "BCRP";
            var amount = op.amount || op.amountUSD || op.nominal || 0;
            var currency = op.currency || "PEN";
            var symbol = currency === "PEN" ? "S/ " : currency === "USD" ? "$ " : "";
            var originP = getParticipant(origin);
            var destP = getParticipant(dest);
            return '<tr>' +
                '<td><strong>' + op.id + '</strong></td>' +
                '<td>' + (OPERATION_TYPES[op.type] || op.type) + '</td>' +
                '<td>' + op.time + '</td>' +
                '<td>' + (originP ? originP.shortName : origin) + '</td>' +
                '<td>' + (destP ? destP.shortName : dest) + '</td>' +
                '<td class="text-right">' + symbol + formatAmount(amount) + '</td>' +
                '<td>' + currency + '</td>' +
                '<td>' + statusBadge(op.status) + '</td>' +
                '</tr>';
        }).join("");
    }

    function renderParticipants() {
        var tbody = document.getElementById("participantList");
        tbody.innerHTML = PARTICIPANTS.map(function (p) {
            return '<tr>' +
                '<td><strong>' + p.code + '</strong></td>' +
                '<td>' + p.name + '</td>' +
                '<td>' + p.type + '</td>' +
                '<td>' + p.connection + '</td>' +
                '<td>' + statusBadge("ACTIVO") + '</td>' +
                '<td>' + p.joinDate + '</td>' +
                '</tr>';
        }).join("");
    }

    function renderSystemLog() {
        var el = document.getElementById("systemLog");
        if (!el) return;
        el.innerHTML = systemLogs.map(function (log) {
            return '<div class="log-entry">' +
                '<span class="log-time">[' + log.time + ']</span> ' +
                '<span class="log-' + log.level + '">' + log.message + '</span>' +
                '</div>';
        }).join("");
    }

    function renderHourlyChart() {
        var container = document.getElementById("hourlyChart");
        var maxVal = Math.max.apply(null, hourlyData) || 1;

        container.innerHTML = hourlyData.map(function (val, i) {
            var hour = i + 6;
            var height = Math.max((val / maxVal) * 200, val > 0 ? 10 : 2);
            return '<div class="chart-bar" style="height:' + height + 'px" data-label="' + String(hour).padStart(2, "0") + 'h" data-value="' + val + '"></div>';
        }).join("");
    }

    // ---- Modal handlers ----
    document.getElementById("modalConfirm").addEventListener("click", function () {
        if (pendingModalAction) {
            pendingModalAction();
        }
        hideModal();
    });

    document.getElementById("modalCancel").addEventListener("click", hideModal);
    document.getElementById("modalClose").addEventListener("click", hideModal);

    document.getElementById("confirmModal").addEventListener("click", function (e) {
        if (e.target === this) hideModal();
    });

    // ---- Keyboard shortcut (Escape) ----
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") hideModal();
    });

    // ---- Initial log entries ----
    addLog("Sistema LBTR v3.2.1 - Esperando inicio de sesion", "info");
    addLog("Red Bancos LBTR-BCRP: Conectividad OK", "success");
    addLog("Modulo de cifrado TLS 1.3: Activo", "info");
    addLog("Ciclo operativo: 06:00 - 20:30 hrs (hora de Lima)", "info");

})();
