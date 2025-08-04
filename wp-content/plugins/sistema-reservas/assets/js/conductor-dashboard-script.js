/**
 * JavaScript para dashboard de conductores
 * Archivo: wp-content/plugins/sistema-reservas/assets/js/conductor-dashboard-script.js
 */

// Variables globales
let conductorCurrentDate = new Date();
let conductorServicesData = {};
let selectedServiceData = null;

/**
 * Cargar sección de calendario para conductores
 */
function loadConductorCalendarSection() {
    console.log('=== CARGANDO CALENDARIO PARA CONDUCTOR ===');
    
    document.body.innerHTML = `
        <div class="conductor-calendar-management">
            <div class="conductor-header">
                <h1>📅 Servicios y Reservas</h1>
                <div class="conductor-actions">
                    <button class="btn-info" onclick="showConductorSummary()">📊 Resumen</button>
                    <button class="btn-secondary" onclick="goBackToDashboard()">← Volver al Dashboard</button>
                </div>
            </div>
            
            <div class="conductor-calendar-controls">
                <button onclick="changeConductorMonth(-1)">← Mes Anterior</button>
                <span id="conductor-current-month"></span>
                <button onclick="changeConductorMonth(1)">Siguiente Mes →</button>
            </div>
            
            <div id="conductor-calendar-container">
                <div class="loading">Cargando calendario...</div>
            </div>
        </div>
        
        <!-- Modal para mostrar reservas de un servicio -->
        <div id="serviceReservationsModal" class="modal" style="display: none;">
            <div class="modal-content" style="max-width: 1000px;">
                <span class="close" onclick="closeServiceReservationsModal()">&times;</span>
                <h3 id="serviceReservationsTitle">Reservas del Servicio</h3>
                <div id="service-reservations-content">
                    <!-- Contenido se cargará aquí -->
                </div>
            </div>
        </div>
        
        <!-- Modal de resumen -->
        <div id="conductorSummaryModal" class="modal" style="display: none;">
            <div class="modal-content" style="max-width: 800px;">
                <span class="close" onclick="closeConductorSummaryModal()">&times;</span>
                <h3>📊 Resumen de Servicios</h3>
                <div id="conductor-summary-content">
                    <div class="loading">Cargando resumen...</div>
                </div>
            </div>
        </div>
        
        <style>
        .conductor-calendar-management {
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .conductor-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #0073aa;
        }
        
        .conductor-header h1 {
            color: #23282d;
            margin: 0;
        }
        
        .conductor-actions {
            display: flex;
            gap: 15px;
        }
        
        .conductor-calendar-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
        }
        
        .conductor-calendar-controls button {
            padding: 10px 20px;
            background: #0073aa;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
        }
        
        .conductor-calendar-controls button:hover {
            background: #005177;
        }
        
        .conductor-calendar-controls span {
            font-size: 18px;
            font-weight: 600;
            color: #23282d;
        }
        
        .conductor-calendar-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 2px;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
        }
        
        .conductor-calendar-day-header {
            background: #0073aa;
            color: white;
            padding: 15px 10px;
            text-align: center;
            font-weight: bold;
            font-size: 14px;
        }
        
        .conductor-calendar-day {
            background: white;
            min-height: 100px;
            padding: 10px;
            border: 1px solid #ddd;
            position: relative;
        }
        
        .conductor-calendar-day.other-month {
            background: #f8f9fa;
            color: #999;
        }
        
        .conductor-calendar-day.has-services {
            background: #e8f5e8;
            border-color: #28a745;
        }
        
        .conductor-day-number {
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 5px;
        }
        
        .conductor-service-item {
            background: #0073aa;
            color: white;
            padding: 4px 6px;
            margin: 2px 0;
            border-radius: 3px;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.3s;
            display: block;
            text-align: center;
        }
        
        .conductor-service-item:hover {
            background: #005177;
            transform: translateY(-1px);
        }
        
        .conductor-service-item.has-reservations {
            background: #28a745;
        }
        
        .conductor-service-item.has-reservations:hover {
            background: #218838;
        }
        
        .reservations-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        
        .reservations-table th,
        .reservations-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        
        .reservations-table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #23282d;
        }
        
        .reservations-table tr:hover {
            background: #f8f9fa;
        }
        
        .status-badge {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .status-confirmada {
            background: #d4edda;
            color: #155724;
        }
        
        .status-cancelada {
            background: #f8d7da;
            color: #721c24;
        }
        
        .status-pendiente {
            background: #fff3cd;
            color: #856404;
        }
        
        .service-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .stat-item {
            text-align: center;
        }
        
        .stat-number {
            font-size: 24px;
            font-weight: bold;
            color: #0073aa;
        }
        
        .stat-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
        }
        
        .service-info {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 4px;
        }
        
        .service-info h4 {
            margin: 0 0 10px 0;
            color: #1976d2;
        }
        
        .origin-badge {
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .origin-directa {
            background: #e3f2fd;
            color: #1976d2;
        }
        
        .origin-agencia {
            background: #f3e5f5;
            color: #7b1fa2;
        }
        
        .verify-btn {
            padding: 4px 8px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
        }
        
        .verify-btn.verified {
            background: #28a745;
            color: white;
        }
        
        .verify-btn.not-verified {
            background: #6c757d;
            color: white;
        }
        
        .summary-sections {
            display: grid;
            gap: 20px;
        }
        
        .summary-section {
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background: white;
        }
        
        .summary-section h4 {
            margin: 0 0 15px 0;
            color: #0073aa;
            font-size: 16px;
            border-bottom: 2px solid #0073aa;
            padding-bottom: 8px;
        }
        
        .service-summary-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            margin: 5px 0;
            background: #f8f9fa;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .service-summary-item:hover {
            background: #e9ecef;
        }
        
        .service-time {
            font-weight: bold;
            color: #0073aa;
        }
        
        .service-occupancy {
            font-size: 12px;
            color: #666;
        }
        
        @media (max-width: 768px) {
            .conductor-calendar-grid {
                grid-template-columns: 1fr;
                gap: 10px;
            }
            
            .conductor-header {
                flex-direction: column;
                gap: 15px;
                text-align: center;
            }
            
            .conductor-actions {
                justify-content: center;
            }
            
            .service-stats {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        </style>
    `;
    
    // Cargar configuración y luego calendario
    loadConductorCalendar();
}

/**
 * Cargar datos del calendario para conductores
 */
function loadConductorCalendar() {
    updateConductorCalendarHeader();
    
    const formData = new FormData();
    formData.append('action', 'get_conductor_calendar_data');
    formData.append('month', conductorCurrentDate.getMonth() + 1);
    formData.append('year', conductorCurrentDate.getFullYear());
    formData.append('nonce', reservasAjax.nonce);
    
    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            conductorServicesData = data.data;
            renderConductorCalendar();
        } else {
            console.error('Error cargando datos del conductor:', data.data);
            document.getElementById('conductor-calendar-container').innerHTML = 
                '<div class="error">Error: ' + data.data + '</div>';
        }
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('conductor-calendar-container').innerHTML = 
            '<div class="error">Error de conexión</div>';
    });
}

/**
 * Actualizar header del calendario
 */
function updateConductorCalendarHeader() {
    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    const monthYear = monthNames[conductorCurrentDate.getMonth()] + ' ' + conductorCurrentDate.getFullYear();
    document.getElementById('conductor-current-month').textContent = monthYear;
}

/**
 * Cambiar mes del calendario
 */
function changeConductorMonth(direction) {
    conductorCurrentDate.setMonth(conductorCurrentDate.getMonth() + direction);
    loadConductorCalendar();
}

/**
 * Renderizar calendario para conductores
 */
function renderConductorCalendar() {
    const year = conductorCurrentDate.getFullYear();
    const month = conductorCurrentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let firstDayOfWeek = firstDay.getDay();
    firstDayOfWeek = (firstDayOfWeek + 6) % 7; // Lunes = 0
    
    const daysInMonth = lastDay.getDate();
    const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    
    let calendarHTML = '<div class="conductor-calendar-grid">';
    
    // Encabezados de días
    dayNames.forEach(day => {
        calendarHTML += `<div class="conductor-calendar-day-header">${day}</div>`;
    });
    
    // Días del mes anterior
    for (let i = 0; i < firstDayOfWeek; i++) {