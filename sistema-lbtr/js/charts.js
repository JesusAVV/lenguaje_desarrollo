/* =====================================================
   Sistema LBTR - Modulo de Graficos
   Graficos SVG puros sin dependencias externas
   ===================================================== */

var LBTRCharts = {
    renderBarChart: function(containerId, data, labels) {
        var container = document.getElementById(containerId);
        if (!container) return;

        var maxVal = 0;
        for (var i = 0; i < data.length; i++) {
            if (data[i] > maxVal) maxVal = data[i];
        }
        if (maxVal === 0) maxVal = 1;

        var html = '<div class="bar-chart" style="padding-bottom:25px;">';
        for (var j = 0; j < data.length; j++) {
            var height = Math.max((data[j] / maxVal) * 180, 2);
            var colors = [
                'linear-gradient(to top, #1a237e, #3949ab)',
                'linear-gradient(to top, #283593, #5c6bc0)',
                'linear-gradient(to top, #1565c0, #42a5f5)'
            ];
            var colorIdx = j % colors.length;
            html += '<div class="bar" style="height:' + height + 'px; background:' + colors[colorIdx] + ';" title="' + labels[j] + ': ' + data[j] + '">';
            if (data[j] > 0) {
                html += '<span class="bar-value">' + data[j] + '</span>';
            }
            html += '<span class="bar-label">' + labels[j] + '</span>';
            html += '</div>';
        }
        html += '</div>';

        container.innerHTML = html;
    },

    renderDonutChart: function(containerId, data, labels, colors) {
        var container = document.getElementById(containerId);
        if (!container) return;

        var total = 0;
        for (var i = 0; i < data.length; i++) {
            total += data[i];
        }

        if (total === 0) {
            container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px;">Sin datos disponibles</div>';
            return;
        }

        var svgSize = 180;
        var cx = svgSize / 2;
        var cy = svgSize / 2;
        var radius = 70;
        var innerRadius = 45;

        var svg = '<svg class="donut-svg" viewBox="0 0 ' + svgSize + ' ' + svgSize + '">';

        var currentAngle = -90;
        for (var j = 0; j < data.length; j++) {
            if (data[j] === 0) continue;
            var percentage = data[j] / total;
            var angle = percentage * 360;
            var startAngle = currentAngle;
            var endAngle = currentAngle + angle;

            var startRad = (startAngle * Math.PI) / 180;
            var endRad = (endAngle * Math.PI) / 180;

            var x1 = cx + radius * Math.cos(startRad);
            var y1 = cy + radius * Math.sin(startRad);
            var x2 = cx + radius * Math.cos(endRad);
            var y2 = cy + radius * Math.sin(endRad);

            var ix1 = cx + innerRadius * Math.cos(startRad);
            var iy1 = cy + innerRadius * Math.sin(startRad);
            var ix2 = cx + innerRadius * Math.cos(endRad);
            var iy2 = cy + innerRadius * Math.sin(endRad);

            var largeArc = angle > 180 ? 1 : 0;

            var d = 'M ' + x1 + ' ' + y1 +
                    ' A ' + radius + ' ' + radius + ' 0 ' + largeArc + ' 1 ' + x2 + ' ' + y2 +
                    ' L ' + ix2 + ' ' + iy2 +
                    ' A ' + innerRadius + ' ' + innerRadius + ' 0 ' + largeArc + ' 0 ' + ix1 + ' ' + iy1 + ' Z';

            svg += '<path d="' + d + '" fill="' + colors[j] + '" stroke="white" stroke-width="2"/>';
            currentAngle = endAngle;
        }

        svg += '<text x="' + cx + '" y="' + (cy - 5) + '" text-anchor="middle" font-size="22" font-weight="700" fill="#1a1a2e">' + total + '</text>';
        svg += '<text x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle" font-size="10" fill="#64748b">Total</text>';
        svg += '</svg>';

        var legend = '<div class="donut-legend">';
        for (var k = 0; k < data.length; k++) {
            var pct = total > 0 ? ((data[k] / total) * 100).toFixed(1) : 0;
            legend += '<div class="legend-item">';
            legend += '<span class="legend-color" style="background:' + colors[k] + '"></span>';
            legend += '<span class="legend-label">' + labels[k] + '</span>';
            legend += '<span class="legend-value">' + data[k] + ' (' + pct + '%)</span>';
            legend += '</div>';
        }
        legend += '</div>';

        container.innerHTML = '<div class="donut-chart">' + svg + legend + '</div>';
    },

    renderHorizontalBarChart: function(containerId, data, labels, colors) {
        var container = document.getElementById(containerId);
        if (!container) return;

        var maxVal = 0;
        for (var i = 0; i < data.length; i++) {
            if (data[i] > maxVal) maxVal = data[i];
        }
        if (maxVal === 0) maxVal = 1;

        var html = '<div style="padding: 10px;">';
        for (var j = 0; j < data.length; j++) {
            var width = Math.max((data[j] / maxVal) * 100, 1);
            var color = colors ? colors[j % colors.length] : '#1a237e';
            html += '<div style="margin-bottom:12px;">';
            html += '<div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px;">';
            html += '<span style="font-weight:500;">' + labels[j] + '</span>';
            html += '<span style="color:#64748b;">' + LBTREngine.formatNumber(data[j]) + '</span>';
            html += '</div>';
            html += '<div style="height:20px;background:#f0f2f5;border-radius:10px;overflow:hidden;">';
            html += '<div style="height:100%;width:' + width + '%;background:' + color + ';border-radius:10px;transition:width 0.5s;"></div>';
            html += '</div>';
            html += '</div>';
        }
        html += '</div>';

        container.innerHTML = html;
    },

    updateDashboardCharts: function(stats) {
        var hourLabels = [];
        var hourData = [];
        for (var h = 9; h <= 17; h++) {
            hourLabels.push(h + ':00');
            hourData.push(stats.hourlyData[h] || 0);
        }
        this.renderBarChart('chartHourly', hourData, hourLabels);

        this.renderDonutChart('chartStatus',
            [stats.statusData.liquidadas, stats.statusData.pendientes, stats.statusData.rechazadas],
            ['Liquidadas', 'Pendientes', 'Rechazadas'],
            ['#2e7d32', '#f57f17', '#c62828']
        );
    },

    updateReportCharts: function() {
        var participantVolumes = {};
        for (var i = 0; i < LBTRData.transactions.length; i++) {
            var tx = LBTRData.transactions[i];
            if (!participantVolumes[tx.sender]) participantVolumes[tx.sender] = 0;
            participantVolumes[tx.sender] += tx.amount;
        }

        var sorted = Object.keys(participantVolumes).sort(function(a, b) {
            return participantVolumes[b] - participantVolumes[a];
        });

        var topLabels = sorted.slice(0, 6);
        var topData = [];
        for (var j = 0; j < topLabels.length; j++) {
            topData.push(participantVolumes[topLabels[j]]);
        }

        var barColors = ['#1a237e', '#283593', '#303f9f', '#3949ab', '#3f51b5', '#5c6bc0'];
        this.renderHorizontalBarChart('chartTopParticipants', topData, topLabels, barColors);

        var last7 = [];
        var last7Labels = [];
        for (var d = 6; d >= 0; d--) {
            var date = new Date();
            date.setDate(date.getDate() - d);
            var dateStr = date.toISOString().split('T')[0];
            last7Labels.push(date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' }));
            var dayTotal = 0;
            for (var k = 0; k < LBTRData.transactions.length; k++) {
                if (LBTRData.transactions[k].timestamp.split('T')[0] === dateStr &&
                    LBTRData.transactions[k].status === 'LIQUIDADA') {
                    dayTotal += LBTRData.transactions[k].amount;
                }
            }
            last7.push(dayTotal);
        }

        this.renderBarChart('chartAmountTrend', last7, last7Labels);
    }
};
