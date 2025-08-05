// Variables globales
let currentDate = new Date();
let servicesData = {};
let bulkHorarios = [];
let bulkHorariosVuelta = [];
let defaultConfig = null; // ✅ NUEVA VARIABLE PARA CONFIGURACIÓN

function loadCalendarSection() {
    document.body.innerHTML = `
        <div class="calendar-management">
            <div class="calendar-header">
                <h1>Gestión de Calendario</h1>
                <div class="calendar-actions">
                    <button class="btn-primary" onclick="showBulkAddModal()">➕ Añadir Múltiples Servicios</button>
                    <button class="btn-secondary" onclick="goBackToDashboard()">← Volver al Dashboard</button>
                </div>
            </div>
            
            <div class="calendar-controls">
                <button onclick="changeMonth(-1)">← Mes Anterior</button>
                <span id="currentMonth"></span>
                <button onclick="changeMonth(1)">Siguiente Mes →</button>
            </div>
            
            <div id="calendar-container">
                <div class="loading">Cargando calendario...</div>
            </div>
        </div>
        <style>
            /* Estilos para servicios deshabilitados */
            .service-item.service-disabled {
                background-color: #f8d7da !important;
                color: #721c24 !important;
                border: 1px solid #f5c6cb !important;
                opacity: 0.8 !important;
                text-decoration: line-through;
            }

            .service-item.service-disabled:hover {
                background-color: #f1b0b7 !important;
                color: #721c24 !important;
                cursor: pointer;
            }

            /* Días con servicios deshabilitados */
            .day-with-disabled {
                background-color: #fff3cd !important;
                border: 2px solid #dc3545 !important;
            }

            .calendar-day.day-with-disabled .day-number {
                color: #dc3545 !important;
                font-weight: bold !important;
                background-color: rgba(220, 53, 69, 0.1);
                border-radius: 3px;
                padding: 2px 4px;
            }

            /* Si el día tiene SOLO servicios deshabilitados, hacerlo más rojo */
            .calendar-day.day-all-disabled {
                background-color: #f8d7da !important;
                border: 2px solid #dc3545 !important;
            }

            .calendar-day.day-all-disabled .day-number {
                background-color: #dc3545 !important;
                color: white !important;
                border-radius: 50%;
                width: 25px;
                height: 25px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto;
            }

            /* Tooltip mejorado */
            .service-item.service-disabled {
                position: relative;
            }

            .service-item.service-disabled:before {
                content: "Deshabilitado - No visible para clientes";
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                background-color: #721c24;
                color: white;
                padding: 5px 8px;
                border-radius: 4px;
                font-size: 11px;
                white-space: nowrap;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s;
                z-index: 1000;
            }

            .service-item.service-disabled:hover:before {
                opacity: 1;
            }
        </style>
    `;


    // ✅ CARGAR CONFIGURACIÓN PRIMERO, LUEGO INICIALIZAR CALENDARIO
    loadDefaultConfiguration().then(() => {
        initCalendar();
    });
}

// ✅ FUNCIÓN PARA MANEJAR ERRORES AJAX
function handleAjaxError(xhr, status, error) {
    console.error('AJAX Error:', {
        status: xhr.status,
        statusText: xhr.statusText,
        responseText: xhr.responseText,
        error: error
    });

    if (xhr.status === 403 || xhr.status === 401) {
        alert('Sesión expirada. Recarga la página e inicia sesión nuevamente.');
        window.location.reload();
    } else if (xhr.status === 400) {
        alert('Error de solicitud. Verifica los datos e inténtalo de nuevo.');
    } else {
        alert('Error de conexión. Inténtalo de nuevo.');
    }
}

function loadDefaultConfiguration() {
    return new Promise((resolve, reject) => {
        console.log('=== CARGANDO CONFIGURACIÓN ===');

        // ✅ VERIFICAR QUE TENEMOS LAS VARIABLES NECESARIAS
        if (typeof reservasAjax === 'undefined') {
            console.error('reservasAjax no está definido');
            // ✅ USAR VALORES POR DEFECTO EN LUGAR DE FALLAR
            defaultConfig = getDefaultConfigValues();
            resolve();
            return;
        }

        const formData = new FormData();
        formData.append('action', 'get_configuration');
        formData.append('nonce', reservasAjax.nonce);

        fetch(reservasAjax.ajax_url, {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        })
            .then(response => {
                console.log('Response status:', response.status);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return response.text();
            })
            .then(text => {
                console.log('Response text length:', text.length);

                try {
                    const data = JSON.parse(text);
                    if (data.success) {
                        defaultConfig = data.data;
                        console.log('✅ Configuración cargada:', defaultConfig);
                        resolve();
                    } else {
                        console.error('❌ Error del servidor:', data.data);
                        defaultConfig = getDefaultConfigValues();
                        resolve();
                    }
                } catch (e) {
                    console.error('❌ Error parsing JSON:', e);
                    console.error('Raw response:', text.substring(0, 500) + '...');
                    defaultConfig = getDefaultConfigValues();
                    resolve();
                }
            })
            .catch(error => {
                console.error('❌ Fetch error:', error);
                defaultConfig = getDefaultConfigValues();
                resolve();
            });
    });
}


function addHorarioVuelta() {
    const horarioInput = document.getElementById('nuevoHorarioVuelta');
    const horario = horarioInput.value;

    if (horario && !bulkHorariosVuelta.find(h => h.hora === horario)) {
        bulkHorariosVuelta.push({
            hora: horario
        });
        horarioInput.value = '';
        updateHorariosVueltaList();
    }
}

function removeHorarioVuelta(index) {
    bulkHorariosVuelta.splice(index, 1);
    updateHorariosVueltaList();
}

function updateHorariosVueltaList() {
    const container = document.getElementById('horariosVueltaList');

    if (bulkHorariosVuelta.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No hay horarios de vuelta añadidos</p>';
        return;
    }

    let html = '';
    bulkHorariosVuelta.forEach((horario, index) => {
        html += `
            <div class="horario-item">
                <span>${horario.hora}</span>
                <button type="button" class="btn-small btn-danger" onclick="removeHorarioVuelta(${index})">Eliminar</button>
            </div>
        `;
    });

    container.innerHTML = html;
}


function getDefaultConfigValues() {
    return {
        precios: {
            precio_adulto_defecto: { value: '10.00' },
            precio_nino_defecto: { value: '5.00' },
            precio_residente_defecto: { value: '5.00' }
        },
        servicios: {
            plazas_defecto: { value: '50' },
            dias_anticipacion_minima: { value: '1' }
        }
    };
}

function initCalendar() {
    updateCalendarDisplay();
    loadCalendarData();
}

function updateCalendarDisplay() {
    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    document.getElementById('currentMonth').textContent =
        monthNames[currentDate.getMonth()] + ' ' + currentDate.getFullYear();
}

function changeMonth(direction) {
    currentDate.setMonth(currentDate.getMonth() + direction);
    updateCalendarDisplay();
    loadCalendarData();
}

function loadCalendarData() {
    console.log('=== INICIANDO CARGA DE CALENDARIO ===');

    if (typeof reservasAjax === 'undefined') {
        console.error('❌ reservasAjax no está definido');
        alert('Error: Variables AJAX no disponibles. Recarga la página.');
        return;
    }

    console.log('AJAX URL:', reservasAjax.ajax_url);
    console.log('Nonce:', reservasAjax.nonce);

    const formData = new FormData();
    formData.append('action', 'get_calendar_data');
    formData.append('month', currentDate.getMonth() + 1);
    formData.append('year', currentDate.getFullYear());
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                servicesData = data.data;
                renderCalendar();
                console.log('✅ Calendario renderizado correctamente');
            } else {
                console.error('❌ Error del servidor:', data.data);
                alert('Error del servidor: ' + (data.data || 'Error desconocido'));
            }
        })
        .catch(error => {
            console.error('❌ Fetch error:', error);
            handleAjaxError({ status: 500, statusText: error.message }, 'error', error);
        });
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let firstDayOfWeek = firstDay.getDay();
    firstDayOfWeek = (firstDayOfWeek + 6) % 7;

    const daysInMonth = lastDay.getDate();
    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    let calendarHTML = '<div class="calendar-grid">';

    // Encabezados de días
    dayNames.forEach(day => {
        calendarHTML += `<div class="calendar-header-day">${day}</div>`;
    });

    // Días del mes anterior
    for (let i = 0; i < firstDayOfWeek; i++) {
        const dayNum = new Date(year, month, -firstDayOfWeek + i + 1).getDate();
        calendarHTML += `<div class="calendar-day other-month">
            <div class="day-number">${dayNum}</div>
        </div>`;
    }

    const diasAnticiapcion = defaultConfig?.servicios?.dias_anticipacion_minima?.value || '1';
    const fechaMinima = new Date();

    if (parseInt(diasAnticiapcion) > 0) {
        fechaMinima.setDate(fechaMinima.getDate() + parseInt(diasAnticiapcion));
    }

    const currentUser = window.reservasUser || {};
    const isSuper = currentUser.role === 'super_admin';

    // Días del mes actual
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayDate = new Date(year, month, day);
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        const todayClass = isToday ? ' today' : '';

        const isBlocked = !isSuper && dayDate < fechaMinima;

        let hasDiscount = false;
        let hasDisabledServices = false;
        let hasEnabledServices = false;
        let totalServices = 0;

        if (servicesData[dateStr]) {
            totalServices = servicesData[dateStr].length;

            servicesData[dateStr].forEach(service => {
                if (service.tiene_descuento && parseFloat(service.porcentaje_descuento) > 0) {
                    hasDiscount = true;
                }

                if (service.enabled === 0 || service.enabled === '0') {
                    hasDisabledServices = true;
                } else {
                    hasEnabledServices = true;
                }
            });
        }

        let servicesHTML = '';
        if (servicesData[dateStr]) {
            servicesData[dateStr].forEach(service => {
                let serviceClass = 'service-item';
                let discountText = '';
                let disabledText = '';

                if (service.tiene_descuento && parseFloat(service.porcentaje_descuento) > 0) {
                    serviceClass += ' service-discount';
                    discountText = ` (${service.porcentaje_descuento}% OFF)`;
                }

                if (service.enabled === 0 || service.enabled === '0') {
                    serviceClass += ' service-disabled';
                    disabledText = ' 🚫';
                }

                // ✅ AÑADIR PLAZAS DISPONIBLES
                const plazasText = ` - ${service.plazas_disponibles} plazas`;
                
                // ✅ AÑADIR CLASE DE ADVERTENCIA SI POCAS PLAZAS
                if (service.plazas_disponibles <= 5 && service.plazas_disponibles > 0) {
                    serviceClass += ' service-low-availability';
                } else if (service.plazas_disponibles === 0) {
                    serviceClass += ' service-full';
                }

                servicesHTML += `<div class="${serviceClass}" onclick="editService(${service.id})">${service.hora}${plazasText}${discountText}${disabledText}</div>`;
            });
        }

        let dayClass = `calendar-day${todayClass}`;

        if (hasDiscount) {
            dayClass += ' day-with-discount';
        }

        if (hasDisabledServices && !hasEnabledServices) {
            dayClass += ' day-all-disabled';
        } else if (hasDisabledServices) {
            dayClass += ' day-with-disabled';
        }

        let clickHandler = `onclick="addService('${dateStr}')"`;
        if (isBlocked) {
            dayClass += ' blocked-day';
            clickHandler = `onclick="showBlockedDayMessage('${dateStr}')"`;
        }

        calendarHTML += `<div class="${dayClass}" ${clickHandler}>
            <div class="day-number">${day}</div>
            ${servicesHTML}
        </div>`;
    }

    calendarHTML += '</div>';
    calendarHTML += getModalHTML();

    document.getElementById('calendar-container').innerHTML = calendarHTML;
    initModalEvents();
}

function showBlockedDayMessage(dateStr = null) {
    // ✅ OBTENER ROL DEL USUARIO ACTUAL
    const currentUser = window.reservasUser || {};
    const isSuper = currentUser.role === 'super_admin';

    if (isSuper) {
        // ✅ Super admin puede crear servicios en cualquier fecha
        console.log('Super admin detectado - permitiendo acceso a cualquier fecha');
        if (dateStr) {
            addService(dateStr); // Llamar directamente a addService
        }
        return true;
    } else {
        const diasAnticiapcion = defaultConfig?.servicios?.dias_anticipacion_minima?.value || '1';
        alert(`No se pueden crear servicios para esta fecha. Se requiere un mínimo de ${diasAnticiapcion} días de anticipación.`);
        return false;
    }
}

function getModalHTML() {
    return `
        <!-- Modal Añadir/Editar Servicio -->
        <div id="serviceModal" class="modal">
            <div class="modal-content">
                <span class="close" onclick="closeServiceModal()">&times;</span>
                <h3 id="serviceModalTitle">Añadir Servicio</h3>
                <form id="serviceForm">
                    <input type="hidden" id="serviceId" name="service_id">
                    
                    <div class="form-group">
                        <label for="serviceFecha">Fecha:</label>
                        <input type="date" id="serviceFecha" name="fecha" required>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="serviceHora">Hora de Ida:</label>
                            <input type="time" id="serviceHora" name="hora" required>
                        </div>
                        <div class="form-group">
                            <label for="serviceHoraVuelta">Hora de Vuelta:</label>
                            <input type="time" id="serviceHoraVuelta" name="hora_vuelta">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="servicePlazas">Plazas Totales:</label>
                        <input type="number" id="servicePlazas" name="plazas_totales" min="1" max="200" required>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="precioAdulto">Precio Adulto (€):</label>
                            <input type="number" id="precioAdulto" name="precio_adulto" step="0.01" min="0" required>
                        </div>
                        <div class="form-group">
                            <label for="precioNino">Precio Niño (€):</label>
                            <input type="number" id="precioNino" name="precio_nino" step="0.01" min="0" required>
                        </div>
                        <div class="form-group">
                            <label for="precioResidente">Precio Residente (€):</label>
                            <input type="number" id="precioResidente" name="precio_residente" step="0.01" min="0" required>
                        </div>
                    </div>
                    
                    <!-- ✅ NUEVA SECCIÓN: DISPONIBILIDAD -->
                    <div class="form-group availability-section" style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0;">
                        <label style="display: flex; align-items: center; font-weight: 600; color: #495057;">
                            <input type="checkbox" id="serviceEnabled" name="enabled" checked style="margin-right: 10px; transform: scale(1.2);"> 
                            Servicio habilitado para reservas
                        </label>
                        <small style="display: block; margin-top: 8px; color: #6c757d; font-style: italic;">
                            Si está desmarcado, este servicio no aparecerá en el calendario público para hacer reservas, pero se mantendrá en el sistema para consultas administrativas.
                        </small>
                    </div>
                    
                    <!-- Sección de descuento AMPLIADA -->
                    <div class="form-group discount-section">
                        <label>
                            <input type="checkbox" id="tieneDescuento" name="tiene_descuento"> 
                            Activar descuento especial para este servicio
                        </label>
                        <div id="discountFields" style="display: none; margin-top: 15px; padding: 15px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9;">
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="porcentajeDescuento">Porcentaje de descuento (%):</label>
                                    <input type="number" id="porcentajeDescuento" name="porcentaje_descuento" 
                                           min="0" max="100" step="0.1" placeholder="Ej: 15">
                                </div>
                                <div class="form-group">
                                    <label for="tipoDescuento">Tipo de descuento:</label>
                                    <select id="tipoDescuento" name="descuento_tipo">
                                        <option value="fijo">Descuento fijo para todos</option>
                                        <option value="por_grupo">Descuento por número mínimo</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group" id="minimoPersonasGroup" style="display: none;">
                                <label for="minimoPersonas">Mínimo de personas para descuento:</label>
                                <input type="number" id="minimoPersonas" name="descuento_minimo_personas" 
                                       min="1" max="100" placeholder="Ej: 5">
                                <small>El descuento se aplicará solo si hay este número mínimo de personas</small>
                            </div>
                            
                            <!-- CAMPOS DE ACUMULACIÓN Y PRIORIDAD -->
                            <div class="form-group accumulation-section" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                                <label>
                                    <input type="checkbox" id="descuentoAcumulable" name="descuento_acumulable"> 
                                    Acumulable con descuentos por grupo
                                </label>
                                <small style="display: block; margin-top: 5px; color: #666; font-style: italic;">
                                    Si está marcado, este descuento se sumará a los descuentos por grupo configurados en el sistema
                                </small>
                            </div>
                            
                            <div class="form-group" id="prioridadGroup" style="display:block !important; margin-top: 10px;">
                                <label for="descuentoPrioridad">Prioridad cuando no es acumulable:</label>
                                <select id="descuentoPrioridad" name="descuento_prioridad">
                                    <option value="servicio">Prioridad al descuento del servicio</option>
                                    <option value="grupo">Prioridad al descuento por configuración</option>
                                </select>
                                <small style="display: block; margin-top: 5px; color: #666; font-style: italic;">
                                    Cuando no sea acumulable, se aplicará el descuento con mayor prioridad
                                </small>
                            </div>
                            
                            <div class="discount-preview" id="discountPreview" style="margin-top: 15px; padding: 10px; background: #e8f4fd; border-radius: 4px; display: none;">
                                <strong>Vista previa:</strong> <span id="discountPreviewText"></span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Guardar Servicio</button>
                        <button type="button" class="btn-secondary" onclick="closeServiceModal()">Cancelar</button>
                        <button type="button" id="deleteServiceBtn" class="btn-danger" onclick="deleteService()" style="display: none;">Eliminar</button>
                    </div>
                </form>
            </div>
        </div>
        
        <!-- Modal bulk sin cambios -->
        <div id="bulkAddModal" class="modal">
            <div class="modal-content">
                <span class="close" onclick="closeBulkAddModal()">&times;</span>
                <h3>Añadir Múltiples Servicios</h3>
                <form id="bulkAddForm">
                    <!-- ✅ AÑADIR TAMBIÉN EL CHECKBOX PARA SERVICIOS BULK -->
                    <div class="form-group availability-section" style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0;">
                        <label style="display: flex; align-items: center; font-weight: 600; color: #495057;">
                            <input type="checkbox" id="bulkServiceEnabled" name="bulk_enabled" checked style="margin-right: 10px; transform: scale(1.2);"> 
                            Servicios habilitados para reservas
                        </label>
                        <small style="display: block; margin-top: 8px; color: #6c757d; font-style: italic;">
                            Si está desmarcado, estos servicios no aparecerán en el calendario público
                        </small>
                    </div>
                    
                    <!-- Resto del formulario bulk sin cambios -->
                    <div class="form-row">
                        <div class="form-group">
                            <label for="bulkFechaInicio">Fecha Inicio:</label>
                            <input type="date" id="bulkFechaInicio" name="fecha_inicio" required>
                        </div>
                        <div class="form-group">
                            <label for="bulkFechaFin">Fecha Fin:</label>
                            <input type="date" id="bulkFechaFin" name="fecha_fin" required>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Días de la semana:</label>
                        <div class="days-grid">
                            <label><input type="checkbox" name="dias_semana[]" value="1"> Lunes</label>
                            <label><input type="checkbox" name="dias_semana[]" value="2"> Martes</label>
                            <label><input type="checkbox" name="dias_semana[]" value="3"> Miércoles</label>
                            <label><input type="checkbox" name="dias_semana[]" value="4"> Jueves</label>
                            <label><input type="checkbox" name="dias_semana[]" value="5"> Viernes</label>
                            <label><input type="checkbox" name="dias_semana[]" value="6"> Sábado</label>
                            <label><input type="checkbox" name="dias_semana[]" value="0"> Domingo</label>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <h4>Horarios de Ida</h4>
                            <div class="horarios-input">
                                <input type="time" id="nuevoHorario">
                                <button type="button" onclick="addHorario()">Añadir</button>
                            </div>
                            <div id="horariosList"></div>
                        </div>
                        <div class="form-group">
                            <h4>Horarios de Vuelta</h4>
                            <div class="horarios-input">
                                <input type="time" id="nuevoHorarioVuelta">
                                <button type="button" onclick="addHorarioVuelta()">Añadir</button>
                            </div>
                            <div id="horariosVueltaList"></div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="bulkPlazas">Plazas Totales:</label>
                        <input type="number" id="bulkPlazas" name="plazas_totales" min="1" max="200" required>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="bulkPrecioAdulto">Precio Adulto (€):</label>
                            <input type="number" id="bulkPrecioAdulto" name="precio_adulto" step="0.01" min="0" required>
                        </div>
                        <div class="form-group">
                            <label for="bulkPrecioNino">Precio Niño (€):</label>
                            <input type="number" id="bulkPrecioNino" name="precio_nino" step="0.01" min="0" required>
                        </div>
                        <div class="form-group">
                            <label for="bulkPrecioResidente">Precio Residente (€):</label>
                            <input type="number" id="bulkPrecioResidente" name="precio_residente" step="0.01" min="0" required>
                        </div>
                    </div>
                    
                    <!-- Sección de descuento para bulk sin cambios -->
                    <div class="form-group discount-section">
                        <label>
                            <input type="checkbox" id="bulkTieneDescuento" name="bulk_tiene_descuento"> 
                            Aplicar descuento especial a todos los servicios
                        </label>
                        <div id="bulkDiscountFields" style="display: none; margin-top: 15px; padding: 15px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9;">
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="bulkPorcentajeDescuento">Porcentaje de descuento (%):</label>
                                    <input type="number" id="bulkPorcentajeDescuento" name="bulk_porcentaje_descuento" 
                                           min="0" max="100" step="0.1" placeholder="Ej: 15">
                                </div>
                                <div class="form-group">
                                    <label for="bulkTipoDescuento">Tipo de descuento:</label>
                                    <select id="bulkTipoDescuento" name="bulk_descuento_tipo">
                                        <option value="fijo">Descuento fijo para todos</option>
                                        <option value="por_grupo">Descuento por número mínimo</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group" id="bulkMinimoPersonasGroup" style="display: none;">
                                <label for="bulkMinimoPersonas">Mínimo de personas para descuento:</label>
                                <input type="number" id="bulkMinimoPersonas" name="bulk_descuento_minimo_personas" 
                                       min="1" max="100" placeholder="Ej: 5">
                                <small>El descuento se aplicará solo si hay este número mínimo de personas</small>
                            </div>
                            
                            <div class="form-group accumulation-section" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                                <label>
                                    <input type="checkbox" id="bulkDescuentoAcumulable" name="bulk_descuento_acumulable"> 
                                    Acumulable con descuentos por grupo
                                </label>
                            </div>
                            
                            <div class="form-group" id="bulkPrioridadGroup" style="display:block; margin-top: 10px;">
                                <label for="bulkDescuentoPrioridad">Prioridad cuando no es acumulablee:</label>
                                <select id="bulkDescuentoPrioridad" name="bulk_descuento_prioridad">
                                    <option value="servicio">Prioridad al descuento del servicio</option>
                                    <option value="grupo">Prioridad al descuento por grupo</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Crear Servicios</button>
                        <button type="button" class="btn-secondary" onclick="closeBulkAddModal()">Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function initModalEvents() {
    // Formulario de servicio individual
    document.getElementById('serviceForm').addEventListener('submit', function (e) {
        e.preventDefault();
        saveService();
    });

    // Formulario de servicios masivos
    document.getElementById('bulkAddForm').addEventListener('submit', function (e) {
        e.preventDefault();
        saveBulkServices();
    });

    // ✅ EVENTOS PARA DESCUENTO INDIVIDUAL
    const tieneDescuentoEl = document.getElementById('tieneDescuento');
    if (tieneDescuentoEl) {
        tieneDescuentoEl.addEventListener('change', function () {
            const discountFields = document.getElementById('discountFields');
            if (this.checked) {
                discountFields.style.display = 'block';
                updateDiscountPreview();
                // ✅ INICIALIZAR VISIBILIDAD CUANDO SE ACTIVA
                setTimeout(initializeDiscountFieldsVisibility, 50);
            } else {
                discountFields.style.display = 'none';
                document.getElementById('porcentajeDescuento').value = '';
                document.getElementById('tipoDescuento').value = 'fijo';
                document.getElementById('minimoPersonas').value = 1;
                document.getElementById('minimoPersonasGroup').style.display = 'none';

                const preview = document.getElementById('discountPreview');
                if (preview) preview.style.display = 'none';
            }
        });
    }

    // ✅ EVENTOS PARA TIPO DE DESCUENTO
    const tipoDescuentoEl = document.getElementById('tipoDescuento');
    if (tipoDescuentoEl) {
        tipoDescuentoEl.addEventListener('change', function () {
            toggleMinimoPersonasField('tipoDescuento', 'minimoPersonasGroup');
            updateDiscountPreview();
        });
    }

    // ✅ EVENTOS PARA ACTUALIZAR VISTA PREVIA
    const porcentajeEl = document.getElementById('porcentajeDescuento');
    if (porcentajeEl) {
        porcentajeEl.addEventListener('input', updateDiscountPreview);
    }

    const minimoEl = document.getElementById('minimoPersonas');
    if (minimoEl) {
        minimoEl.addEventListener('input', updateDiscountPreview);
    }

    // ✅ EVENTOS PARA ACUMULACIÓN
    const acumulableEl = document.getElementById('descuentoAcumulable');
    if (acumulableEl) {
        acumulableEl.addEventListener('change', function () {
            togglePrioridadField('descuentoAcumulable', 'prioridadGroup');
            updateDiscountPreview();
        });
    }

    const prioridadEl = document.getElementById('descuentoPrioridad');
    if (prioridadEl) {
        prioridadEl.addEventListener('change', updateDiscountPreview);
    }

    // ✅ EVENTOS PARA DESCUENTO BULK
    const bulkTieneDescuentoEl = document.getElementById('bulkTieneDescuento');
    if (bulkTieneDescuentoEl) {
        bulkTieneDescuentoEl.addEventListener('change', function () {
            const bulkDiscountFields = document.getElementById('bulkDiscountFields');
            if (this.checked) {
                bulkDiscountFields.style.display = 'block';
                // ✅ INICIALIZAR VISIBILIDAD PARA BULK
                setTimeout(initializeDiscountFieldsVisibility, 50);
            } else {
                bulkDiscountFields.style.display = 'none';
                document.getElementById('bulkPorcentajeDescuento').value = '';
                document.getElementById('bulkTipoDescuento').value = 'fijo';
                document.getElementById('bulkMinimoPersonas').value = 1;
                document.getElementById('bulkMinimoPersonasGroup').style.display = 'none';
            }
        });
    }

    const bulkTipoDescuentoEl = document.getElementById('bulkTipoDescuento');
    if (bulkTipoDescuentoEl) {
        bulkTipoDescuentoEl.addEventListener('change', function () {
            toggleMinimoPersonasField('bulkTipoDescuento', 'bulkMinimoPersonasGroup');
        });
    }

    const bulkAcumulableEl = document.getElementById('bulkDescuentoAcumulable');
    if (bulkAcumulableEl) {
        bulkAcumulableEl.addEventListener('change', function () {
            togglePrioridadField('bulkDescuentoAcumulable', 'bulkPrioridadGroup');
        });
    }

    // ✅ INICIALIZAR VISIBILIDAD AL CARGAR MODAL
    setTimeout(initializeDiscountFieldsVisibility, 100);
}

function initializeDiscountFieldsVisibility() {
    console.log('=== INICIALIZANDO VISIBILIDAD DE CAMPOS DE DESCUENTO ===');

    // Para modal de servicio individual
    const tieneDescuentoEl = document.getElementById('tieneDescuento');
    if (tieneDescuentoEl && tieneDescuentoEl.checked) {
        const discountFields = document.getElementById('discountFields');
        if (discountFields) {
            discountFields.style.display = 'block';
        }

        // Verificar y mostrar/ocultar campos según valores actuales
        const tipoDescuentoEl = document.getElementById('tipoDescuento');
        if (tipoDescuentoEl) {
            toggleMinimoPersonasField('tipoDescuento', 'minimoPersonasGroup');
        }

        const acumulableEl = document.getElementById('descuentoAcumulable');
        if (acumulableEl) {
            togglePrioridadField('descuentoAcumulable', 'prioridadGroup');
        }
    }

    // Para modal bulk
    const bulkTieneDescuentoEl = document.getElementById('bulkTieneDescuento');
    if (bulkTieneDescuentoEl && bulkTieneDescuentoEl.checked) {
        const bulkDiscountFields = document.getElementById('bulkDiscountFields');
        if (bulkDiscountFields) {
            bulkDiscountFields.style.display = 'block';
        }

        const bulkTipoDescuentoEl = document.getElementById('bulkTipoDescuento');
        if (bulkTipoDescuentoEl) {
            toggleMinimoPersonasField('bulkTipoDescuento', 'bulkMinimoPersonasGroup');
        }

        const bulkAcumulableEl = document.getElementById('bulkDescuentoAcumulable');
        if (bulkAcumulableEl) {
            togglePrioridadField('bulkDescuentoAcumulable', 'bulkPrioridadGroup');
        }
    }
}

function togglePrioridadField(checkboxId, groupId) {
    const checkbox = document.getElementById(checkboxId);
    const group = document.getElementById(groupId);

    if (!checkbox || !group) {
        console.warn(`No se encontraron elementos: ${checkboxId} o ${groupId}`);
        return;
    }

    console.log(`togglePrioridadField: checkbox ${checkboxId} está ${checkbox.checked ? 'marcado' : 'desmarcado'}`);

    // Si NO es acumulable, mostrar campo de prioridad
    if (!checkbox.checked) {
        group.style.display = 'block';
        console.log(`Mostrando grupo de prioridad: ${groupId}`);
    } else {
        group.style.display = 'none';
        console.log(`Ocultando grupo de prioridad: ${groupId}`);
    }
}


function toggleMinimoPersonasField(selectId, groupId) {
    const select = document.getElementById(selectId);
    const group = document.getElementById(groupId);

    if (!select || !group) return;

    if (select.value === 'por_grupo') {
        group.style.display = 'block';
    } else {
        group.style.display = 'none';
    }
}


function updateDiscountPreview() {
    const porcentaje = document.getElementById('porcentajeDescuento').value;
    const tipo = document.getElementById('tipoDescuento').value;
    const minimo = document.getElementById('minimoPersonas').value;
    const acumulable = document.getElementById('descuentoAcumulable').checked;
    const prioridad = document.getElementById('descuentoPrioridad').value;
    const preview = document.getElementById('discountPreview');
    const previewText = document.getElementById('discountPreviewText');

    if (!preview || !previewText) {
        console.warn('Elementos de vista previa no encontrados');
        return;
    }

    if (!porcentaje || porcentaje <= 0) {
        preview.style.display = 'none';
        return;
    }

    let texto = '';

    // Texto base del descuento
    if (tipo === 'fijo') {
        texto = `Se aplicará un ${porcentaje}% de descuento a todas las reservas de este servicio`;
    } else if (tipo === 'por_grupo' && minimo) {
        texto = `Se aplicará un ${porcentaje}% de descuento solo cuando haya ${minimo} o más personas`;
    } else {
        preview.style.display = 'none';
        return;
    }

    // Añadir información sobre acumulación
    if (acumulable) {
        texto += '. <br><strong>Se acumulará</strong> con cualquier descuento por grupo que aplique.';
    } else {
        if (prioridad === 'servicio') {
            texto += '. <br><strong>Tendrá prioridad</strong> sobre los descuentos por grupo.';
        } else {
            texto += '. <br><strong>Los descuentos por grupo tendrán prioridad</strong> sobre este descuento.';
        }
    }

    previewText.innerHTML = texto;
    preview.style.display = 'block';
}


function addService(fecha) {
    // ✅ VERIFICAR DÍAS DE ANTICIPACIÓN ANTES DE ABRIR MODAL
    const diasAnticiapcion = defaultConfig?.servicios?.dias_anticipacion_minima?.value || '1';
    const fechaMinima = new Date();
    fechaMinima.setDate(fechaMinima.getDate() + parseInt(diasAnticiapcion));
    const fechaSeleccionada = new Date(fecha);

    // ✅ OBTENER ROL DEL USUARIO ACTUAL
    const currentUser = window.reservasUser || {};
    const isSuper = currentUser.role === 'super_admin';

    if (!isSuper && fechaSeleccionada < fechaMinima) {
        showBlockedDayMessage();
        return;
    }

    document.getElementById('serviceModalTitle').textContent = 'Añadir Servicio';
    document.getElementById('serviceForm').reset();

    // Configurar campos con verificación
    const serviceId = document.getElementById('serviceId');
    const serviceFecha = document.getElementById('serviceFecha');
    const deleteBtn = document.getElementById('deleteServiceBtn');

    if (serviceId) serviceId.value = '';
    if (serviceFecha) serviceFecha.value = fecha;
    if (deleteBtn) deleteBtn.style.display = 'none';

    // ✅ USAR VALORES DE CONFIGURACIÓN POR DEFECTO
    const defaultPrices = defaultConfig?.precios || {};
    const defaultPlazas = defaultConfig?.servicios?.plazas_defecto?.value || '50';

    const elements = [
        { id: 'servicePlazas', value: defaultPlazas },
        { id: 'precioAdulto', value: defaultPrices.precio_adulto_defecto?.value || '10.00' },
        { id: 'precioNino', value: defaultPrices.precio_nino_defecto?.value || '5.00' },
        { id: 'precioResidente', value: defaultPrices.precio_residente_defecto?.value || '5.00' }
    ];

    elements.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) el.value = item.value;
    });

    // Ocultar campos de descuento por defecto
    const discountFields = document.getElementById('discountFields');
    const tieneDescuento = document.getElementById('tieneDescuento');
    const porcentajeDescuento = document.getElementById('porcentajeDescuento');

    if (discountFields) discountFields.style.display = 'none';
    if (tieneDescuento) tieneDescuento.checked = false;
    if (porcentajeDescuento) porcentajeDescuento.value = '';

    document.getElementById('serviceModal').style.display = 'block';
}

function editService(serviceId) {
    console.log('=== EDITANDO SERVICIO ===');
    console.log('Service ID:', serviceId);

    const formData = new FormData();
    formData.append('action', 'get_service_details');
    formData.append('service_id', serviceId);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
    })
        .then(response => response.text().then(text => {
            console.log('Response text:', text);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${text}`);
            }
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('JSON Parse Error:', e);
                throw new Error('Invalid JSON response: ' + text);
            }
        }))
        .then(data => {
            console.log('Service details response:', data);
            if (data.success) {
                const service = data.data;

                // Configurar modal para edición
                document.getElementById('serviceModalTitle').textContent = 'Editar Servicio';

                // Rellenar campos básicos
                const serviceId = document.getElementById('serviceId');
                const serviceFecha = document.getElementById('serviceFecha');
                const serviceHora = document.getElementById('serviceHora');
                const serviceHoraVuelta = document.getElementById('serviceHoraVuelta');
                const servicePlazas = document.getElementById('servicePlazas');
                const precioAdulto = document.getElementById('precioAdulto');
                const precioNino = document.getElementById('precioNino');
                const precioResidente = document.getElementById('precioResidente');

                if (serviceId) serviceId.value = service.id;
                if (serviceFecha) serviceFecha.value = service.fecha;
                if (serviceHora) serviceHora.value = service.hora;
                if (serviceHoraVuelta) serviceHoraVuelta.value = service.hora_vuelta || '';
                if (servicePlazas) servicePlazas.value = service.plazas_totales;
                if (precioAdulto) precioAdulto.value = service.precio_adulto;
                if (precioNino) precioNino.value = service.precio_nino;
                if (precioResidente) precioResidente.value = service.precio_residente;

                // Configurar campo enabled
                const serviceEnabled = document.getElementById('serviceEnabled');
                if (serviceEnabled) {
                    serviceEnabled.checked = service.enabled !== undefined ? service.enabled == '1' : true;
                }

                // Configurar campos de descuento
                const tieneDescuento = service.tiene_descuento == '1';
                const tieneDescuentoEl = document.getElementById('tieneDescuento');
                if (tieneDescuentoEl) {
                    tieneDescuentoEl.checked = tieneDescuento;
                }

                if (tieneDescuento) {
                    // Mostrar sección de descuento
                    const discountFields = document.getElementById('discountFields');
                    if (discountFields) {
                        discountFields.style.display = 'block';
                    }

                    // Rellenar valores de descuento
                    const porcentajeDescuento = document.getElementById('porcentajeDescuento');
                    if (porcentajeDescuento) {
                        porcentajeDescuento.value = service.porcentaje_descuento || '';
                    }

                    const tipoDescuento = service.descuento_tipo || 'fijo';
                    const tipoDescuentoEl = document.getElementById('tipoDescuento');
                    if (tipoDescuentoEl) {
                        tipoDescuentoEl.value = tipoDescuento;
                    }

                    const minimoPersonas = document.getElementById('minimoPersonas');
                    if (minimoPersonas) {
                        minimoPersonas.value = service.descuento_minimo_personas || 1;
                    }

                    const minimoPersonasGroup = document.getElementById('minimoPersonasGroup');
                    if (minimoPersonasGroup) {
                        if (tipoDescuento === 'por_grupo') {
                            minimoPersonasGroup.style.display = 'block';
                        } else {
                            minimoPersonasGroup.style.display = 'none';
                        }
                    }

                    const acumulable = service.descuento_acumulable == '1';
                    const descuentoAcumulableEl = document.getElementById('descuentoAcumulable');
                    if (descuentoAcumulableEl) {
                        descuentoAcumulableEl.checked = acumulable;
                    }

                    const prioridad = service.descuento_prioridad || 'servicio';
                    const descuentoPrioridadEl = document.getElementById('descuentoPrioridad');
                    if (descuentoPrioridadEl) {
                        descuentoPrioridadEl.value = prioridad;
                    }

                    // ✅ CORREGIR: Mostrar/ocultar campo de prioridad según estado de acumulable
                    const prioridadGroup = document.getElementById('prioridadGroup');
                    if (prioridadGroup) {
                        if (!acumulable) {
                            prioridadGroup.style.display = 'block';
                        } else {
                            prioridadGroup.style.display = 'none';
                        }
                    }

                    updateDiscountPreview();
                } else {
                    // Ocultar sección de descuento y resetear valores
                    const discountFields = document.getElementById('discountFields');
                    if (discountFields) {
                        discountFields.style.display = 'none';
                    }

                    // Resetear valores
                    const elements = [
                        'porcentajeDescuento', 'tipoDescuento', 'minimoPersonas',
                        'descuentoAcumulable', 'descuentoPrioridad'
                    ];

                    elements.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) {
                            if (el.type === 'checkbox') {
                                el.checked = false;
                            } else {
                                el.value = (id === 'tipoDescuento' || id === 'descuentoPrioridad') ?
                                    (id === 'tipoDescuento' ? 'fijo' : 'servicio') :
                                    (id === 'minimoPersonas' ? 1 : '');
                            }
                        }
                    });

                    const groups = ['minimoPersonasGroup', 'prioridadGroup'];
                    groups.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.style.display = 'none';
                    });

                    const preview = document.getElementById('discountPreview');
                    if (preview) preview.style.display = 'none';
                }

                // Mostrar botón de eliminar y abrir modal
                const deleteBtn = document.getElementById('deleteServiceBtn');
                if (deleteBtn) {
                    deleteBtn.style.display = 'block';
                }

                document.getElementById('serviceModal').style.display = 'block';

                console.log('✅ Modal de edición configurado correctamente');
            } else {
                console.error('Error del servidor:', data.data);
                alert('Error al cargar el servicio: ' + data.data);
            }
        })
        .catch(error => {
            console.error('Error loading service details:', error);
            alert('Error de conexión: ' + error.message);
        });
}

function saveService() {
    const formData = new FormData(document.getElementById('serviceForm'));
    formData.append('action', 'save_service');
    formData.append('nonce', reservasAjax.nonce);

    // ✅ DEBUGGING MEJORADO
    console.log('=== GUARDANDO SERVICIO ===');
    for (let [key, value] of formData.entries()) {
        console.log(key + ': ' + value);
    }

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
    })
        .then(response => {
            console.log('Response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Response data:', data);
            if (data.success) {
                alert('Servicio guardado correctamente');
                closeServiceModal();
                loadCalendarData();
            } else {
                alert('Error: ' + data.data);
            }
        })
        .catch(error => {
            console.error('Error guardando servicio:', error);
            alert('Error de conexión: ' + error.message);
        });
}

function deleteService() {
    if (!confirm('¿Estás seguro de que quieres eliminar este servicio?')) {
        return;
    }

    const serviceId = document.getElementById('serviceId').value;
    const formData = new FormData();
    formData.append('action', 'delete_service');
    formData.append('service_id', serviceId);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Servicio eliminado correctamente');
                closeServiceModal();
                loadCalendarData();
            } else {
                alert('Error: ' + data.data);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error de conexión');
        });
}

function closeServiceModal() {
    document.getElementById('serviceModal').style.display = 'none';
}

function showBulkAddModal() {
    document.getElementById('bulkAddForm').reset();
    bulkHorarios = [];
    bulkHorariosVuelta = []; // ✅ Resetear horarios de vuelta
    updateHorariosList();
    updateHorariosVueltaList(); // ✅ Actualizar lista de vuelta

    // ✅ USAR VALORES DE CONFIGURACIÓN POR DEFECTO PARA BULK
    const defaultPrices = defaultConfig?.precios || {};
    const defaultPlazas = defaultConfig?.servicios?.plazas_defecto?.value || '50';

    document.getElementById('bulkPlazas').value = defaultPlazas;
    document.getElementById('bulkPrecioAdulto').value = defaultPrices.precio_adulto_defecto?.value || '10.00';
    document.getElementById('bulkPrecioNino').value = defaultPrices.precio_nino_defecto?.value || '5.00';
    document.getElementById('bulkPrecioResidente').value = defaultPrices.precio_residente_defecto?.value || '5.00';

    // ✅ ESTABLECER FECHA MÍNIMA BASADA EN CONFIGURACIÓN
    const diasAnticiapcion = defaultConfig?.servicios?.dias_anticipacion_minima?.value || '1';
    const fechaMinima = new Date();
    fechaMinima.setDate(fechaMinima.getDate() + parseInt(diasAnticiapcion));
    const fechaMinimaStr = fechaMinima.toISOString().split('T')[0];

    document.getElementById('bulkFechaInicio').setAttribute('min', fechaMinimaStr);
    document.getElementById('bulkFechaFin').setAttribute('min', fechaMinimaStr);

    // Ocultar campos de descuento por defecto
    document.getElementById('bulkDiscountFields').style.display = 'none';
    document.getElementById('bulkTieneDescuento').checked = false;
    document.getElementById('bulkPorcentajeDescuento').value = '';

    document.getElementById('bulkAddModal').style.display = 'block';
}

function closeBulkAddModal() {
    document.getElementById('bulkAddModal').style.display = 'none';
}

function addHorario() {
    const horarioInput = document.getElementById('nuevoHorario');
    const horario = horarioInput.value;

    if (horario && !bulkHorarios.find(h => h.hora === horario)) {
        bulkHorarios.push({
            hora: horario
        });
        horarioInput.value = '';
        updateHorariosList();
    }
}

function removeHorario(index) {
    bulkHorarios.splice(index, 1);
    updateHorariosList();
}

function updateHorariosList() {
    const container = document.getElementById('horariosList');

    if (bulkHorarios.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No hay horarios añadidos</p>';
        return;
    }

    let html = '';
    bulkHorarios.forEach((horario, index) => {
        html += `
            <div class="horario-item">
                <span>${horario.hora}</span>
                <button type="button" class="btn-small btn-danger" onclick="removeHorario(${index})">Eliminar</button>
            </div>
        `;
    });

    container.innerHTML = html;
}

function saveBulkServices() {
    if (bulkHorarios.length === 0) {
        alert('Debes añadir al menos un horario de ida');
        return;
    }

    if (bulkHorariosVuelta.length === 0) {
        alert('Debes añadir al menos un horario de vuelta');
        return;
    }

    if (bulkHorarios.length !== bulkHorariosVuelta.length) {
        alert('Debe haber el mismo número de horarios de ida y vuelta');
        return;
    }

    const formData = new FormData(document.getElementById('bulkAddForm'));
    formData.append('action', 'bulk_add_services');
    formData.append('horarios', JSON.stringify(bulkHorarios));
    formData.append('horarios_vuelta', JSON.stringify(bulkHorariosVuelta)); // ✅ Añadir horarios de vuelta
    formData.append('nonce', reservasAjax.nonce);

    // Obtener días de la semana seleccionados
    const diasSeleccionados = [];
    document.querySelectorAll('input[name="dias_semana[]"]:checked').forEach(checkbox => {
        diasSeleccionados.push(checkbox.value);
    });

    diasSeleccionados.forEach(dia => {
        formData.append('dias_semana[]', dia);
    });

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(data.data.mensaje);
                closeBulkAddModal();
                loadCalendarData();
            } else {
                alert('Error: ' + data.data);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error de conexión');
        });
}

function goBackToDashboard() {
    location.reload();
}

// ✅ FUNCIONES PARA GESTIÓN DE DESCUENTOS (mantenidas igual)
function loadDiscountsConfigSection() {
    document.body.innerHTML = `
        <div class="discounts-management">
            <div class="discounts-header">
                <h1>Configuración de Descuentos</h1>
                <div class="discounts-actions">
                    <button class="btn-primary" onclick="showAddDiscountModal()">➕ Añadir Nueva Regla</button>
                    <button class="btn-secondary" onclick="goBackToDashboard()">← Volver al Dashboard</button>
                </div>
            </div>
            
            <div class="current-rules-section">
                <h3>Reglas de Descuento Actuales</h3>
                <div id="discounts-list">
                    <div class="loading">Cargando reglas de descuento...</div>
                </div>
            </div>
        </div>
        
        <!-- Modal Añadir/Editar Regla de Descuento -->
        <div id="discountModal" class="modal">
            <div class="modal-content">
                <span class="close" onclick="closeDiscountModal()">&times;</span>
                <h3 id="discountModalTitle">Añadir Regla de Descuento</h3>
                <form id="discountForm">
                    <input type="hidden" id="discountId" name="discount_id">
                    
                    <div class="form-group">
                        <label for="ruleName">Nombre de la Regla:</label>
                        <input type="text" id="ruleName" name="rule_name" placeholder="Ej: Descuento Grupo Grande" required>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="minimumPersons">Mínimo de Personas:</label>
                            <input type="number" id="minimumPersons" name="minimum_persons" min="1" max="100" placeholder="10" required>
                        </div>
                        <div class="form-group">
                            <label for="discountPercentage">Porcentaje de Descuento (%):</label>
                            <input type="number" id="discountPercentage" name="discount_percentage" min="1" max="100" step="0.1" placeholder="15" required>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="applyTo">Aplicar a:</label>
                        <select id="applyTo" name="apply_to" required>
                            <option value="total">Total de la reserva</option>
                            <option value="adults_only">Solo adultos</option>
                            <option value="all_paid">Todas las personas que pagan</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="ruleDescription">Descripción:</label>
                        <textarea id="ruleDescription" name="rule_description" rows="3" placeholder="Describe cuándo se aplica este descuento"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="isActive" name="is_active" checked>
                            Regla activa
                        </label>
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Guardar Regla</button>
                        <button type="button" class="btn-secondary" onclick="closeDiscountModal()">Cancelar</button>
                        <button type="button" id="deleteDiscountBtn" class="btn-danger" onclick="deleteDiscountRule()" style="display: none;">Eliminar</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Inicializar eventos
    initDiscountEvents();

    // Cargar reglas existentes
    loadDiscountRules();
}

function initDiscountEvents() {
    // Formulario de regla de descuento
    document.getElementById('discountForm').addEventListener('submit', function (e) {
        e.preventDefault();
        saveDiscountRule();
    });
}

function loadDiscountRules() {
    const formData = new FormData();
    formData.append('action', 'get_discount_rules');
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderDiscountRules(data.data);
            } else {
                document.getElementById('discounts-list').innerHTML =
                    '<p class="error">Error cargando las reglas: ' + data.data + '</p>';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('discounts-list').innerHTML =
                '<p class="error">Error de conexión</p>';
        });
}

function renderDiscountRules(rules) {
    let html = '';

    if (rules.length === 0) {
        html = `
            <div class="no-rules">
                <p>No hay reglas de descuento configuradas.</p>
                <button class="btn-primary" onclick="showAddDiscountModal()">Crear Primera Regla</button>
            </div>
        `;
    } else {
        html = `
            <div class="rules-table">
                <table>
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Mínimo Personas</th>
                            <th>Descuento</th>
                            <th>Aplicar a</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        rules.forEach(rule => {
            const statusClass = rule.is_active == 1 ? 'status-active' : 'status-inactive';
            const statusText = rule.is_active == 1 ? 'Activa' : 'Inactiva';
            const applyToText = getApplyToText(rule.apply_to);

            html += `
                <tr>
                    <td>${rule.rule_name}</td>
                    <td>${rule.minimum_persons} personas</td>
                    <td>${rule.discount_percentage}%</td>
                    <td>${applyToText}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn-edit" onclick="editDiscountRule(${rule.id})">Editar</button>
                        <button class="btn-delete" onclick="confirmDeleteRule(${rule.id})">Eliminar</button>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
    }

    document.getElementById('discounts-list').innerHTML = html;
}

function getApplyToText(applyTo) {
    const texts = {
        'total': 'Total de la reserva',
        'adults_only': 'Solo adultos',
        'all_paid': 'Personas que pagan'
    };
    return texts[applyTo] || applyTo;
}

function showAddDiscountModal() {
    document.getElementById('discountModalTitle').textContent = 'Añadir Regla de Descuento';
    document.getElementById('discountForm').reset();
    document.getElementById('discountId').value = '';
    document.getElementById('deleteDiscountBtn').style.display = 'none';
    document.getElementById('isActive').checked = true;

    // Valores por defecto
    document.getElementById('minimumPersons').value = 10;
    document.getElementById('discountPercentage').value = 15;
    document.getElementById('applyTo').value = 'total';

    document.getElementById('discountModal').style.display = 'block';
}

function editDiscountRule(ruleId) {
    const formData = new FormData();
    formData.append('action', 'get_discount_rule_details');
    formData.append('rule_id', ruleId);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const rule = data.data;
                document.getElementById('discountModalTitle').textContent = 'Editar Regla de Descuento';
                document.getElementById('discountId').value = rule.id;
                document.getElementById('ruleName').value = rule.rule_name;
                document.getElementById('minimumPersons').value = rule.minimum_persons;
                document.getElementById('discountPercentage').value = rule.discount_percentage;
                document.getElementById('applyTo').value = rule.apply_to;
                document.getElementById('ruleDescription').value = rule.rule_description || '';
                document.getElementById('isActive').checked = rule.is_active == 1;
                document.getElementById('deleteDiscountBtn').style.display = 'block';

                document.getElementById('discountModal').style.display = 'block';
            } else {
                alert('Error al cargar la regla: ' + data.data);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error de conexión');
        });
}

function saveDiscountRule() {
    const formData = new FormData(document.getElementById('discountForm'));
    formData.append('action', 'save_discount_rule');
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Regla guardada correctamente');
                closeDiscountModal();
                loadDiscountRules();
            } else {
                alert('Error: ' + data.data);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error de conexión');
        });
}

function confirmDeleteRule(ruleId) {
    if (confirm('¿Estás seguro de que quieres eliminar esta regla de descuento?')) {
        deleteDiscountRule(ruleId);
    }
}

function deleteDiscountRule(ruleId = null) {
    const id = ruleId || document.getElementById('discountId').value;

    const formData = new FormData();
    formData.append('action', 'delete_discount_rule');
    formData.append('rule_id', id);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Regla eliminada correctamente');
                closeDiscountModal();
                loadDiscountRules();
            } else {
                alert('Error: ' + data.data);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error de conexión');
        });
}

function closeDiscountModal() {
    document.getElementById('discountModal').style.display = 'none';
}

// ✅ FUNCIONES PARA CONFIGURACIÓN DEL SISTEMA (actualizadas sin personalización e idioma)
function loadConfigurationSection() {
    document.body.innerHTML = `
        <div class="configuration-management">
            <div class="configuration-header">
                <h1>⚙️ Configuración del Sistema</h1>
                <div class="configuration-actions">
                    <button class="btn-primary" onclick="saveAllConfiguration()">💾 Guardar Toda la Configuración</button>
                    <button class="btn-secondary" onclick="goBackToDashboard()">← Volver al Dashboard</button>
                </div>
            </div>
            
            <div class="configuration-content">
                <div class="loading">Cargando configuración...</div>
            </div>
        </div>
    `;

    // Cargar configuración actual
    loadConfigurationData();
}

function loadConfigurationData() {
    const formData = new FormData();
    formData.append('action', 'get_configuration');
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderConfigurationForm(data.data);
            } else {
                document.querySelector('.configuration-content').innerHTML =
                    '<p class="error">Error cargando la configuración: ' + data.data + '</p>';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.querySelector('.configuration-content').innerHTML =
                '<p class="error">Error de conexión</p>';
        });
}

// ✅ FUNCIÓN ACTUALIZADA SIN CHECKBOX DE CONFIRMACIÓN + NUEVO CAMPO
function renderConfigurationForm(configs) {
    let html = `
        <form id="configurationForm" class="configuration-form">
            
            <!-- Sección: Precios por Defecto -->
            <div class="config-section">
                <h3>💰 Precios por Defecto para Nuevos Servicios</h3>
                <div class="config-grid">
                    <div class="config-item">
                        <label for="precio_adulto_defecto">Precio Adulto (€)</label>
                        <input type="number" id="precio_adulto_defecto" name="precio_adulto_defecto" 
                               step="0.01" min="0" value="${configs.precios?.precio_adulto_defecto?.value || '10.00'}">
                        <small>${configs.precios?.precio_adulto_defecto?.description || ''}</small>
                    </div>
                    <div class="config-item">
                        <label for="precio_nino_defecto">Precio Niño (€)</label>
                        <input type="number" id="precio_nino_defecto" name="precio_nino_defecto" 
                               step="0.01" min="0" value="${configs.precios?.precio_nino_defecto?.value || '5.00'}">
                        <small>${configs.precios?.precio_nino_defecto?.description || ''}</small>
                    </div>
                    <div class="config-item">
                        <label for="precio_residente_defecto">Precio Residente (€)</label>
                        <input type="number" id="precio_residente_defecto" name="precio_residente_defecto" 
                               step="0.01" min="0" value="${configs.precios?.precio_residente_defecto?.value || '5.00'}">
                        <small>${configs.precios?.precio_residente_defecto?.description || ''}</small>
                    </div>
                </div>
            </div>

            <!-- Sección: Configuración de Servicios -->
            <div class="config-section">
                <h3>🚌 Configuración de Servicios</h3>
                <div class="config-grid">
                    <div class="config-item">
                        <label for="plazas_defecto">Plazas por Defecto</label>
                        <input type="number" id="plazas_defecto" name="plazas_defecto" 
                               min="1" max="200" value="${configs.servicios?.plazas_defecto?.value || '50'}">
                        <small>${configs.servicios?.plazas_defecto?.description || ''}</small>
                    </div>
                    <div class="config-item">
                        <label for="dias_anticipacion_minima">Días Anticipación Mínima</label>
                        <input type="number" id="dias_anticipacion_minima" name="dias_anticipacion_minima" 
                               min="0" max="30" value="${configs.servicios?.dias_anticipacion_minima?.value || '1'}">
                        <small>${configs.servicios?.dias_anticipacion_minima?.description || ''}</small>
                    </div>
                </div>
            </div>

            <!-- ✅ SECCIÓN ACTUALIZADA: Notificaciones - SIN CHECKBOX DE CONFIRMACIÓN -->
            <div class="config-section">
                <h3>📧 Notificaciones por Email</h3>
                <div class="config-grid">
                    <div class="config-item config-checkbox">
                        <label>
                            <input type="checkbox" id="email_recordatorio_activo" name="email_recordatorio_activo" 
                                   ${configs.notificaciones?.email_recordatorio_activo?.value == '1' ? 'checked' : ''}>
                            Recordatorios Automáticos antes del Viaje
                        </label>
                        <small>${configs.notificaciones?.email_recordatorio_activo?.description || ''}</small>
                    </div>
                    <div class="config-item">
                        <label for="horas_recordatorio">Horas antes para Recordatorio</label>
                        <input type="number" id="horas_recordatorio" name="horas_recordatorio" 
                               min="1" max="168" value="${configs.notificaciones?.horas_recordatorio?.value || '24'}">
                        <small>${configs.notificaciones?.horas_recordatorio?.description || ''}</small>
                    </div>
                    <div class="config-item">
                        <label for="email_remitente">Email Remitente (Técnico)</label>
                        <input type="email" id="email_remitente" name="email_remitente" 
                               value="${configs.notificaciones?.email_remitente?.value || ''}"
                               style="background-color: #fff3cd; border: 2px solid #ffc107;">
                        <small style="color: #856404; font-weight: bold;">⚠️ ${configs.notificaciones?.email_remitente?.description || 'Email técnico desde el que se envían todos los correos - NO MODIFICAR sin conocimientos técnicos'}</small>
                    </div>
                    <div class="config-item">
                        <label for="nombre_remitente">Nombre del Remitente</label>
                        <input type="text" id="nombre_remitente" name="nombre_remitente" 
                               value="${configs.notificaciones?.nombre_remitente?.value || ''}">
                        <small>${configs.notificaciones?.nombre_remitente?.description || ''}</small>
                    </div>
                    <!-- ✅ NUEVO CAMPO: Email de Reservas -->
                    <div class="config-item">
                        <label for="email_reservas">Email de Reservas</label>
                        <input type="email" id="email_reservas" name="email_reservas" 
                               value="${configs.notificaciones?.email_reservas?.value || ''}"
                               style="background-color: #e8f5e8; border: 2px solid #28a745;">
                        <small style="color: #155724; font-weight: bold;">📧 ${configs.notificaciones?.email_reservas?.description || 'Email donde llegarán las notificaciones de nuevas reservas de clientes'}</small>
                    </div>
                </div>
                
                <!-- ✅ INFORMACIÓN ADICIONAL SOBRE EMAILS -->
                <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #2196f3;">
                    <h4 style="margin-top: 0; color: #1565c0;">ℹ️ Información sobre Emails</h4>
                    <ul style="margin: 0; padding-left: 20px; color: #1565c0;">
                        <li><strong>Confirmaciones:</strong> Se envían automáticamente SIEMPRE al cliente tras cada reserva</li>
                        <li><strong>Recordatorios:</strong> Se envían automáticamente según las horas configuradas</li>
                        <li><strong>Notificaciones de reservas:</strong> Llegan al "Email de Reservas" cada vez que un cliente hace una reserva</li>
                        <li><strong>Email Remitente:</strong> Es el email técnico desde el que se envían todos los correos</li>
                    </ul>
                </div>
            </div>

            <!-- Sección: Configuración General -->
            <div class="config-section">
                <h3>🌍 Configuración General</h3>
                <div class="config-grid">
                    <div class="config-item">
                        <label for="zona_horaria">Zona Horaria</label>
                        <select id="zona_horaria" name="zona_horaria">
                            <option value="Europe/Madrid" ${configs.general?.zona_horaria?.value === 'Europe/Madrid' ? 'selected' : ''}>Europe/Madrid</option>
                            <option value="Europe/London" ${configs.general?.zona_horaria?.value === 'Europe/London' ? 'selected' : ''}>Europe/London</option>
                            <option value="America/New_York" ${configs.general?.zona_horaria?.value === 'America/New_York' ? 'selected' : ''}>America/New_York</option>
                        </select>
                        <small>${configs.general?.zona_horaria?.description || ''}</small>
                    </div>
                    <div class="config-item">
                        <label for="moneda">Moneda</label>
                        <select id="moneda" name="moneda">
                            <option value="EUR" ${configs.general?.moneda?.value === 'EUR' ? 'selected' : ''}>EUR - Euro</option>
                            <option value="USD" ${configs.general?.moneda?.value === 'USD' ? 'selected' : ''}>USD - Dólar</option>
                            <option value="GBP" ${configs.general?.moneda?.value === 'GBP' ? 'selected' : ''}>GBP - Libra</option>
                        </select>
                        <small>${configs.general?.moneda?.description || ''}</small>
                    </div>
                    <div class="config-item">
                        <label for="simbolo_moneda">Símbolo de Moneda</label>
                        <input type="text" id="simbolo_moneda" name="simbolo_moneda" maxlength="3"
                               value="${configs.general?.simbolo_moneda?.value || '€'}">
                        <small>${configs.general?.simbolo_moneda?.description || ''}</small>
                    </div>
                </div>
            </div>

            <!-- Botones de acción -->
            <div class="config-actions">
                <button type="submit" class="btn-primary btn-large">💾 Guardar Toda la Configuración</button>
                <button type="button" class="btn-secondary" onclick="resetConfigurationForm()">🔄 Resetear Formulario</button>
            </div>
        </form>
    `;

    document.querySelector('.configuration-content').innerHTML = html;

    // Inicializar eventos del formulario
    initConfigurationEvents();
}

function initConfigurationEvents() {
    // Formulario de configuración
    document.getElementById('configurationForm').addEventListener('submit', function (e) {
        e.preventDefault();
        saveAllConfiguration();
    });

    // Eventos para los selectores de moneda (sincronizar símbolo)
    document.getElementById('moneda').addEventListener('change', function () {
        const monedaSeleccionada = this.value;
        const simboloInput = document.getElementById('simbolo_moneda');

        const simbolos = {
            'EUR': '€',
            'USD': ',',
            'GBP': '£'
        };

        if (simbolos[monedaSeleccionada]) {
            simboloInput.value = simbolos[monedaSeleccionada];
        }
    });
}

function saveAllConfiguration() {
    const form = document.getElementById('configurationForm');
    const formData = new FormData(form);
    formData.append('action', 'save_configuration');
    formData.append('nonce', reservasAjax.nonce);

    // Mostrar estado de carga
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = '⏳ Guardando...';

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            // Restaurar botón
            submitButton.disabled = false;
            submitButton.textContent = originalText;

            if (data.success) {
                alert('✅ ' + data.data);

                // ✅ RECARGAR CONFIGURACIÓN POR DEFECTO DESPUÉS DE GUARDAR
                loadDefaultConfiguration().then(() => {
                    showConfigurationNotification('Configuración guardada y sincronizada exitosamente', 'success');
                });
            } else {
                alert('❌ Error: ' + data.data);
                showConfigurationNotification('Error guardando configuración: ' + data.data, 'error');
            }
        })
        .catch(error => {
            // Restaurar botón
            submitButton.disabled = false;
            submitButton.textContent = originalText;

            console.error('Error:', error);
            alert('❌ Error de conexión: ' + error.message);
            showConfigurationNotification('Error de conexión', 'error');
        });
}

function resetConfigurationForm() {
    if (confirm('¿Estás seguro de que quieres resetear el formulario? Se perderán los cambios no guardados.')) {
        loadConfigurationData(); // Recargar datos originales
    }
}

function showConfigurationNotification(message, type) {
    // Crear notificación temporal
    const notification = document.createElement('div');
    notification.className = `config-notification config-notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">✕</button>
    `;

    // Agregar al top de la página
    const header = document.querySelector('.configuration-header');
    header.insertAdjacentElement('afterend', notification);

    // Auto-eliminar después de 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}



function loadReportsSection() {
    document.body.innerHTML = `
        <div class="reports-management">
            <div class="reports-header">
                <h1>📊 Informes y Gestión de Reservas</h1>
                <div class="reports-actions">
                    <button class="btn-primary" onclick="showQuickStatsModal()">📈 Estadísticas Rápidas</button>
                    <button class="btn-secondary" onclick="goBackToDashboard()">← Volver al Dashboard</button>
                </div>
            </div>
            
            <!-- Pestañas de navegación -->
            <div class="reports-tabs">
                <button class="tab-btn active" onclick="switchTab('reservations')">🎫 Gestión de Reservas</button>
                <button class="tab-btn" onclick="switchTab('search')">🔍 Buscar Billetes</button>
                <button class="tab-btn" onclick="switchTab('analytics')">📊 Análisis por Fechas</button>
            </div>
            
            <!-- Contenido de las pestañas -->
            <div class="tab-content">
                <!-- Pestaña 1: Gestión de Reservas CON FILTROS MEJORADOS -->
                <div id="tab-reservations" class="tab-panel active">
                    <div class="reservations-section">
                        <h3>Gestión de Reservas con Filtros Avanzados</h3>
                        
                        <!-- ✅ FILTROS MEJORADOS CON AGENCIAS -->
                        <div class="advanced-filters">
                            <div class="filters-row">
                                <div class="filter-group">
                                    <label for="fecha-inicio">Fecha Inicio:</label>
                                    <input type="date" id="fecha-inicio" value="${new Date().toISOString().split('T')[0]}">
                                </div>
                                <div class="filter-group">
                                    <label for="fecha-fin">Fecha Fin:</label>
                                    <input type="date" id="fecha-fin" value="${new Date().toISOString().split('T')[0]}">
                                </div>
                                <div class="filter-group">
                                    <label for="tipo-fecha">Tipo de Fecha:</label>
                                    <select id="tipo-fecha">
                                        <option value="servicio">Fecha de Servicio</option>
                                        <option value="compra">Fecha de Compra</option>
                                    </select>
                                </div>
                                <div class="filter-group">
                                    <label for="estado-filtro">Estado de Reservas:</label>
                                    <select id="estado-filtro">
                                        <option value="confirmadas">Solo Confirmadas</option>
                                        <option value="todas">Todas (Confirmadas y Canceladas)</option>
                                        <option value="canceladas">Solo Canceladas</option>
                                    </select>
                                </div>
                                <!-- ✅ NUEVO FILTRO POR AGENCIAS -->
                                <div class="filter-group">
                                    <label for="agency-filtro">Filtrar por Agencia:</label>
                                    <select id="agency-filtro">
                                        <option value="todas">🔄 Cargando agencias...</option>
                                    </select>
                                </div>
                                <div class="filter-group">
                                    <button class="btn-primary" onclick="loadReservationsByDateWithFilters()">🔍 Aplicar Filtros</button>
                                </div>
                            </div>
                        </div>
                        
                        <div id="reservations-stats" class="stats-summary" style="display: none;">
                            <!-- Estadísticas se cargarán aquí -->
                        </div>
                        
                        <div id="reservations-list" class="reservations-table">
                            <!-- Lista de reservas se cargará aquí -->
                        </div>
                        
                        <div id="reservations-pagination" class="pagination-controls">
                            <!-- Paginación se cargará aquí -->
                        </div>
                    </div>
                </div>
                
                <!-- Pestaña 2: Buscar Billetes -->
                <div id="tab-search" class="tab-panel">
                    <div class="search-section">
                        <h3>Buscar Billetes</h3>
                        <div class="search-form">
                            <div class="search-row">
                                <select id="search-type">
                                    <option value="localizador">Localizador</option>
                                    <option value="email">Email</option>
                                    <option value="telefono">Teléfono</option>
                                    <option value="nombre">Nombre/Apellidos</option>
                                    <option value="fecha_emision">Fecha de Emisión</option>
                                    <option value="fecha_servicio">Fecha de Servicio</option>
                                </select>
                                <input type="text" id="search-value" placeholder="Introduce el valor a buscar...">
                                <button class="btn-primary" onclick="searchReservations()">🔍 Buscar</button>
                            </div>
                        </div>
                        
                        <div id="search-results" class="search-results">
                            <!-- Resultados de búsqueda se cargarán aquí -->
                        </div>
                    </div>
                </div>
                
                <!-- Pestaña 3: Análisis por Fechas -->
                <div id="tab-analytics" class="tab-panel">
                    <div class="analytics-section">
                        <h3>Análisis Estadístico por Períodos</h3>
                        <div class="analytics-filters">
                            <div class="quick-ranges">
                                <h4>Períodos Rápidos:</h4>
                                <button class="range-btn" onclick="loadRangeStats('7_days')">Últimos 7 días</button>
                                <button class="range-btn" onclick="loadRangeStats('30_days')">Últimos 30 días</button>
                                <button class="range-btn" onclick="loadRangeStats('60_days')">Últimos 60 días</button>
                                <button class="range-btn" onclick="loadRangeStats('this_month')">Este mes</button>
                                <button class="range-btn" onclick="loadRangeStats('last_month')">Mes pasado</button>
                                <button class="range-btn" onclick="loadRangeStats('this_year')">Este año</button>
                            </div>
                            
                            <div class="custom-range">
                                <h4>Rango Personalizado:</h4>
                                <input type="date" id="custom-fecha-inicio" placeholder="Fecha inicio">
                                <input type="date" id="custom-fecha-fin" placeholder="Fecha fin">
                                <button class="btn-primary" onclick="loadCustomRangeStats()">Analizar Período</button>
                            </div>
                        </div>
                        
                        <div id="analytics-results" class="analytics-results">
                            <!-- Resultados de análisis se cargarán aquí -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Modal para estadísticas rápidas -->
        <div id="quickStatsModal" class="modal" style="display: none;">
            <div class="modal-content">
                <span class="close" onclick="closeQuickStatsModal()">&times;</span>
                <h3>📈 Estadísticas Rápidas</h3>
                <div id="quick-stats-content">
                    <div class="loading">Cargando estadísticas...</div>
                </div>
            </div>
        </div>
        
        <!-- Modal para detalles de reserva -->
        <div id="reservationDetailsModal" class="modal" style="display: none;">
            <div class="modal-content">
                <span class="close" onclick="closeReservationDetailsModal()">&times;</span>
                <h3 id="reservationModalTitle">Detalles de Reserva</h3>
                <div id="reservation-details-content">
                    <!-- Contenido se cargará aquí -->
                </div>
            </div>
        </div>
        
        <!-- Modal para editar email -->
        <div id="editEmailModal" class="modal" style="display: none;">
            <div class="modal-content">
                <span class="close" onclick="closeEditEmailModal()">&times;</span>
                <h3>✏️ Editar Email de Cliente</h3>
                <form id="editEmailForm">
                    <input type="hidden" id="edit-reserva-id">
                    <div class="form-group">
                        <label for="current-email">Email Actual:</label>
                        <input type="email" id="current-email" readonly>
                    </div>
                    <div class="form-group">
                        <label for="new-email">Nuevo Email:</label>
                        <input type="email" id="new-email" required>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">💾 Actualizar Email</button>
                        <button type="button" class="btn-secondary" onclick="closeEditEmailModal()">Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
        
        <style>
        /* ✅ NUEVOS ESTILOS PARA FILTROS AVANZADOS */
        .advanced-filters {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            border: 1px solid #dee2e6;
        }
        
        .filters-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 20px;
            align-items: end;
        }
        
        .filter-group {
            display: flex;
            flex-direction: column;
        }
        
        .filter-group label {
            font-weight: 600;
            margin-bottom: 5px;
            color: #495057;
            font-size: 14px;
        }
        
        .filter-group input,
        .filter-group select {
            padding: 8px 12px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 14px;
            transition: border-color 0.3s;
        }
        
        .filter-group input:focus,
        .filter-group select:focus {
            outline: none;
            border-color: #0073aa;
            box-shadow: 0 0 0 2px rgba(0, 115, 170, 0.1);
        }
        
        /* Mejorar estadísticas para mostrar canceladas */
        .stats-by-status {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
            padding: 20px;
            background: #fff3cd;
            border-radius: 8px;
            border-left: 4px solid #ffc107;
        }
        
        .status-stat-card {
            background: white;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .status-stat-card h5 {
            margin: 0 0 10px 0;
            color: #495057;
            font-size: 14px;
            text-transform: uppercase;
        }
        
        .status-stat-card .stat-number {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .status-confirmada .stat-number {
            color: #28a745;
        }
        
        .status-cancelada .stat-number {
            color: #dc3545;
        }
        
        .status-pendiente .stat-number {
            color: #ffc107;
        }
        </style>
    `;

    console.log('🔧 Configurando eventos de reports...');
    initReportsEvents();

    console.log('🔄 Iniciando carga de agencias...');
    loadAgenciesForFilter().then(() => {
        console.log('✅ Agencias cargadas, iniciando carga de datos...');
        loadReservationsByDateWithFilters();
    }).catch(error => {
        console.error('❌ Error cargando agencias:', error);
        // Continuar con la carga de datos aunque fallen las agencias
        loadReservationsByDateWithFilters();
    });
}

function loadReservationsByDateWithFilters(page = 1) {
    const fechaInicio = document.getElementById('fecha-inicio').value;
    const fechaFin = document.getElementById('fecha-fin').value;
    const tipoFecha = document.getElementById('tipo-fecha').value;
    const estadoFiltro = document.getElementById('estado-filtro').value;
    const agencyFiltro = document.getElementById('agency-filtro').value;

    console.log('=== APLICANDO FILTROS ===');
    console.log('Fecha inicio:', fechaInicio);
    console.log('Fecha fin:', fechaFin);
    console.log('Tipo fecha:', tipoFecha);
    console.log('Estado filtro:', estadoFiltro);
    console.log('Agency filtro:', agencyFiltro);

    if (!fechaInicio || !fechaFin) {
        alert('Por favor, selecciona ambas fechas');
        return;
    }

    document.getElementById('reservations-list').innerHTML = '<div class="loading">Cargando reservas...</div>';

    const formData = new FormData();
    formData.append('action', 'get_reservations_report');
    formData.append('fecha_inicio', fechaInicio);
    formData.append('fecha_fin', fechaFin);
    formData.append('tipo_fecha', tipoFecha);
    formData.append('estado_filtro', estadoFiltro);
    formData.append('agency_filter', agencyFiltro);
    formData.append('page', page);
    formData.append('nonce', reservasAjax.nonce);

    console.log('Enviando solicitud con filtros...');

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            console.log('Respuesta del servidor:', data);

            if (data.success) {
                console.log('✅ Datos cargados correctamente');
                console.log('Total reservas encontradas:', data.data.stats.total_reservas);
                renderReservationsReportWithFilters(data.data);
            } else {
                console.error('❌ Error del servidor:', data.data);
                document.getElementById('reservations-list').innerHTML =
                    '<div class="error">Error: ' + data.data + '</div>';
            }
        })
        .catch(error => {
            console.error('❌ Error de conexión:', error);
            document.getElementById('reservations-list').innerHTML =
                '<div class="error">Error de conexión</div>';
        });
}

function renderReservationsReportWithFilters(data) {
    // Mostrar estadísticas principales (sin cambios)
    const statsHtml = `
        <div class="stats-cards">
            <div class="stat-card">
                <h4>Total Reservas</h4>
                <div class="stat-number">${data.stats.total_reservas || 0}</div>
            </div>
            <div class="stat-card">
                <h4>Adultos</h4>
                <div class="stat-number">${data.stats.total_adultos || 0}</div>
            </div>
            <div class="stat-card">
                <h4>Residentes</h4>
                <div class="stat-number">${data.stats.total_residentes || 0}</div>
            </div>
            <div class="stat-card">
                <h4>Niños (5-12)</h4>
                <div class="stat-number">${data.stats.total_ninos_5_12 || 0}</div>
            </div>
            <div class="stat-card">
                <h4>Niños (-5)</h4>
                <div class="stat-number">${data.stats.total_ninos_menores || 0}</div>
            </div>
            <div class="stat-card">
                <h4>Ingresos del Filtro</h4>
                <div class="stat-number">${parseFloat(data.stats.ingresos_totales || 0).toFixed(2)}€</div>
            </div>
        </div>
    `;

    let statsCompleteHtml = statsHtml;

    // Estadísticas por estado (sin cambios)
    if (data.stats_por_estado && data.stats_por_estado.length > 0) {
        let statusStatsHtml = '<div class="stats-by-status"><h4 style="grid-column: 1/-1; margin: 0;">📊 Desglose por Estado</h4>';

        data.stats_por_estado.forEach(stat => {
            const statusText = stat.estado === 'confirmada' ? 'Confirmadas' :
                stat.estado === 'cancelada' ? 'Canceladas' :
                    stat.estado === 'pendiente' ? 'Pendientes' : stat.estado;

            statusStatsHtml += `
                <div class="status-stat-card status-${stat.estado}">
                    <h5>${statusText}</h5>
                    <div class="stat-number">${stat.total}</div>
                    <div class="stat-amount">${parseFloat(stat.ingresos || 0).toFixed(2)}€</div>
                </div>
            `;
        });

        statusStatsHtml += '</div>';
        statsCompleteHtml += statusStatsHtml;
    }

    // ✅ NUEVO: ESTADÍSTICAS POR AGENCIAS
    if (data.stats_por_agencias && data.stats_por_agencias.length > 0) {
        let agencyStatsHtml = '<div class="stats-by-agencies"><h4 style="grid-column: 1/-1; margin: 0;">🏢 Desglose por Agencias</h4>';

        data.stats_por_agencias.forEach(stat => {
            const agencyName = stat.agency_name || 'Sin Agencia';
            const avgPerReserva = stat.total_reservas > 0 ? (parseFloat(stat.ingresos_total) / parseInt(stat.total_reservas)).toFixed(2) : '0.00';

            agencyStatsHtml += `
                <div class="agency-stat-card">
                    <h5>${agencyName}</h5>
                    <div class="stat-number">${stat.total_reservas}</div>
                    <div class="stat-amount">${parseFloat(stat.ingresos_total || 0).toFixed(2)}€</div>
                    <div class="stat-extra">${stat.total_personas} personas</div>
                    <div class="stat-avg">Media: ${avgPerReserva}€/reserva</div>
                </div>
            `;
        });

        agencyStatsHtml += '</div>';
        statsCompleteHtml += agencyStatsHtml;
    }

    document.getElementById('reservations-stats').innerHTML = statsCompleteHtml;
    document.getElementById('reservations-stats').style.display = 'block';

    // ✅ DETERMINAR TEXTO DEL FILTRO APLICADO MEJORADO
    const tipoFechaText = data.filtros.tipo_fecha === 'compra' ? 'Fecha de Compra' : 'Fecha de Servicio';

    let estadoText = '';
    switch (data.filtros.estado_filtro) {
        case 'confirmadas':
            estadoText = ' (solo confirmadas)';
            break;
        case 'canceladas':
            estadoText = ' (solo canceladas)';
            break;
        case 'todas':
            estadoText = ' (todas las reservas)';
            break;
    }

    // ✅ NUEVO: TEXTO DEL FILTRO DE AGENCIAS
    let agencyText = '';
    switch (data.filtros.agency_filter) {
        case 'sin_agencia':
            agencyText = ' - Reservas directas';
            break;
        case 'todas':
            agencyText = ' - Todas las agencias';
            break;
        default:
            if (data.filtros.agency_filter && data.filtros.agency_filter !== 'todas') {
                // Buscar el nombre de la agencia en el select
                const agencySelect = document.getElementById('agency-filtro');
                const selectedOption = agencySelect.querySelector(`option[value="${data.filtros.agency_filter}"]`);
                if (selectedOption) {
                    agencyText = ` - ${selectedOption.textContent}`;
                } else {
                    agencyText = ` - Agencia ID: ${data.filtros.agency_filter}`;
                }
            }
            break;
    }

    // Mostrar tabla de reservas
    let tableHtml = `
        <div class="table-header">
            <h4>Reservas por ${tipoFechaText}: ${data.filtros.fecha_inicio} al ${data.filtros.fecha_fin}${estadoText}${agencyText}</h4>
        </div>
        <table class="reservations-table-data">
            <thead>
                <tr>
                    <th>Localizador</th>
                    <th>Fecha Servicio</th>
                    <th>Fecha Compra</th>
                    <th>Hora</th>
                    <th>Cliente</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Personas</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Agencia</th> <!-- ✅ NUEVA COLUMNA -->
                    
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (data.reservas && data.reservas.length > 0) {
        data.reservas.forEach(reserva => {
            const fechaServicioFormateada = new Date(reserva.fecha).toLocaleDateString('es-ES');
            const fechaCompraFormateada = new Date(reserva.created_at).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            const personasDetalle = `A:${reserva.adultos} R:${reserva.residentes} N:${reserva.ninos_5_12} B:${reserva.ninos_menores}`;

            // Clase CSS para el estado
            let estadoClass = 'status-confirmada';
            let rowClass = '';
            if (reserva.estado === 'cancelada') {
                estadoClass = 'status-cancelada';
                rowClass = 'reservation-cancelled';
            }
            if (reserva.estado === 'pendiente') {
                estadoClass = 'status-pendiente';
            }
            let agencyInfo = 'Directa';
            let agencyClass = 'agency-direct';
            if (reserva.agency_name) {
                agencyInfo = reserva.agency_name;
                agencyClass = 'agency-name';
            }

            tableHtml += `
               <tr class="${rowClass}">
                   <td><strong>${reserva.localizador}</strong></td>
                   <td>${fechaServicioFormateada}</td>
                   <td><small>${fechaCompraFormateada}</small></td>
                   <td>${reserva.hora}</td>
                   <td>${reserva.nombre} ${reserva.apellidos}</td>
                   <td>${reserva.email}</td>
                   <td>${reserva.telefono}</td>
                   <td title="Adultos: ${reserva.adultos}, Residentes: ${reserva.residentes}, Niños 5-12: ${reserva.ninos_5_12}, Menores: ${reserva.ninos_menores}">${personasDetalle}</td>
                   <td><strong>${parseFloat(reserva.precio_final).toFixed(2)}€</strong></td>
                   <td><span class="status-badge ${estadoClass}">${reserva.estado.toUpperCase()}</span></td>
                   <td><span class="agency-badge ${agencyClass}">${agencyInfo}</span></td>
                   
                   <td>
                        <button class="btn-small btn-info" onclick="showReservationDetails(${reserva.id})" title="Ver detalles">👁️</button>
                        
                        ${reserva.estado !== 'cancelada' ?
                    `<button class="btn-small btn-warning" onclick="showEditReservationModal(${reserva.id})" title="Editar fecha/horario">📅</button>` :
                    ''
                }
                        <button class="btn-small btn-primary" onclick="resendConfirmationEmail(${reserva.id})" title="Reenviar confirmación">📧</button>
                        <!-- ✅ AÑADIR ESTE BOTÓN -->
                        <button class="btn-small btn-success" onclick="downloadTicketPDF(${reserva.id}, '${reserva.localizador}')" title="Descargar PDF">📄</button>
                        ${reserva.estado !== 'cancelada' ?
                    `<button class="btn-small btn-danger" onclick="showCancelReservationModal(${reserva.id}, '${reserva.localizador}')" title="Cancelar reserva">❌</button>` :
                    `<span class="btn-small" style="background: #6c757d; color: white;">CANCELADA</span>`
                }
                    </td>
               </tr>
           `;
        });
    } else {
        tableHtml += `
           <tr>
               <td colspan="12" style="text-align: center; padding: 40px; color: #666;">
                   No se encontraron reservas con los filtros aplicados
               </td>
           </tr>
       `;
    }

    tableHtml += `
           </tbody>
       </table>
       
       <style>
       .reservation-cancelled {
           background-color: #f8d7da;
           opacity: 0.8;
       }
       
       .status-badge.status-confirmada {
           background: #d4edda;
           color: #155724;
       }
       
       .status-badge.status-cancelada {
           background: #f8d7da;
           color: #721c24;
       }
       
       .status-badge.status-pendiente {
           background: #fff3cd;
           color: #856404;
       }
       
       /* ✅ NUEVOS ESTILOS PARA AGENCIAS */
       .agency-badge {
           padding: 4px 8px;
           border-radius: 12px;
           font-size: 11px;
           font-weight: 600;
           text-transform: uppercase;
       }
       
       .agency-badge.agency-direct {
           background: #e3f2fd;
           color: #1976d2;
       }
       
       .agency-badge.agency-name {
           background: #f3e5f5;
           color: #7b1fa2;
       }
       
       /* ✅ ESTILOS PARA ESTADÍSTICAS POR AGENCIAS */
       .stats-by-agencies {
           display: grid;
           grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
           gap: 15px;
           margin-top: 20px;
           padding: 20px;
           background: #f3e5f5;
           border-radius: 8px;
           border-left: 4px solid #7b1fa2;
       }
       
       .agency-stat-card {
           background: white;
           padding: 15px;
           border-radius: 6px;
           text-align: center;
           box-shadow: 0 2px 4px rgba(0,0,0,0.1);
           border-left: 3px solid #7b1fa2;
       }
       
       .agency-stat-card h5 {
           margin: 0 0 10px 0;
           color: #495057;
           font-size: 13px;
           text-transform: uppercase;
           font-weight: 600;
       }
       
       .agency-stat-card .stat-number {
           font-size: 20px;
           font-weight: bold;
           margin-bottom: 5px;
           color: #7b1fa2;
       }
       
       .agency-stat-card .stat-amount {
           font-size: 16px;
           font-weight: 600;
           color: #28a745;
           margin-bottom: 5px;
       }
       
       .agency-stat-card .stat-extra {
           font-size: 12px;
           color: #666;
           margin-bottom: 3px;
       }
       
       .agency-stat-card .stat-avg {
           font-size: 11px;
           color: #666;
           font-style: italic;
       }
       </style>
   `;

    document.getElementById('reservations-list').innerHTML = tableHtml;

    // Mostrar paginación (sin cambios)
    if (data.pagination && data.pagination.total_pages > 1) {
        renderPaginationWithFilters(data.pagination);
    } else {
        document.getElementById('reservations-pagination').innerHTML = '';
    }
}

function renderPaginationWithFilters(pagination) {
    let paginationHtml = '<div class="pagination">';

    // Botón anterior
    if (pagination.current_page > 1) {
        paginationHtml += `<button class="btn-pagination" onclick="loadReservationsByDateWithFilters(${pagination.current_page - 1})">« Anterior</button>`;
    }

    // Números de página
    for (let i = 1; i <= pagination.total_pages; i++) {
        if (i === pagination.current_page) {
            paginationHtml += `<button class="btn-pagination active">${i}</button>`;
        } else {
            paginationHtml += `<button class="btn-pagination" onclick="loadReservationsByDateWithFilters(${i})">${i}</button>`;
        }
    }

    // Botón siguiente
    if (pagination.current_page < pagination.total_pages) {
        paginationHtml += `<button class="btn-pagination" onclick="loadReservationsByDateWithFilters(${pagination.current_page + 1})">Siguiente »</button>`;
    }

    paginationHtml += `</div>
        <div class="pagination-info">
            Página ${pagination.current_page} de ${pagination.total_pages} 
            (${pagination.total_items} reservas total)
        </div>`;

    document.getElementById('reservations-pagination').innerHTML = paginationHtml;
}

function loadAgenciesForFilter() {
    return new Promise((resolve, reject) => {
        console.log('=== CARGANDO AGENCIAS PARA FILTRO ===');

        const agencySelect = document.getElementById('agency-filtro');
        if (!agencySelect) {
            console.error('❌ No se encontró el select agency-filtro');
            reject('Select no encontrado');
            return;
        }

        const formData = new FormData();
        formData.append('action', 'get_agencies_for_filter');
        formData.append('nonce', reservasAjax.nonce);

        fetch(reservasAjax.ajax_url, {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                console.log('✅ Respuesta del servidor para agencias:', data);

                if (data.success && data.data && data.data.length > 0) {
                    console.log(`📋 Procesando ${data.data.length} agencias encontradas`);

                    // Limpiar y llenar el select
                    agencySelect.innerHTML = `
                        <option value="todas">Todas las agencias</option>
                        <option value="sin_agencia">Reservas directas (sin agencia)</option>
                    `;

                    // Añadir cada agencia como opción
                    data.data.forEach((agency, index) => {
                        console.log(`📝 Procesando agencia ${index + 1}:`, agency);

                        const option = document.createElement('option');
                        option.value = agency.id;

                        // Construir nombre para mostrar
                        let displayName = agency.agency_name;

                        // Añadir inicial si existe y es diferente de 'A'
                        if (agency.inicial_localizador && agency.inicial_localizador !== 'A') {
                            displayName += ` (${agency.inicial_localizador})`;
                        }

                        // Añadir número de reservas si las tiene
                        if (agency.reservas_count && agency.reservas_count > 0) {
                            displayName += ` - ${agency.reservas_count} reservas`;
                        }

                        // Marcar como inactiva si no está activa
                        if (agency.status !== 'active') {
                            displayName += ` [INACTIVA]`;
                            option.style.color = '#dc3545';
                            option.style.fontStyle = 'italic';
                        }

                        option.textContent = displayName;
                        agencySelect.appendChild(option);

                        console.log(`✅ Agencia añadida: ID=${agency.id}, Nombre="${displayName}"`);
                    });

                    console.log(`🎉 Total de ${data.data.length} agencias cargadas en el selector`);
                    resolve();

                } else {
                    console.warn('⚠️ No se encontraron agencias o respuesta vacía');

                    // Opción por defecto si no hay agencias
                    agencySelect.innerHTML = `
                        <option value="todas">Todas las agencias</option>
                        <option value="sin_agencia">Reservas directas (sin agencia)</option>
                        <option value="" disabled style="color: #666;">No hay agencias disponibles</option>
                    `;
                    resolve();
                }
            })
            .catch(error => {
                console.error('❌ Error de conexión cargando agencias:', error);

                // Opción de error
                agencySelect.innerHTML = `
                    <option value="todas">Todas las agencias</option>
                    <option value="sin_agencia">Reservas directas (sin agencia)</option>
                    <option value="" disabled style="color: #dc3545;">Error cargando agencias</option>
                `;
                reject(error);
            });
    });
}

function initReportsEvents() {
    // Evento para el formulario de editar email
    document.getElementById('editEmailForm').addEventListener('submit', function (e) {
        e.preventDefault();
        updateReservationEmail();
    });

    // Evento para cambiar tipo de búsqueda
    document.getElementById('search-type').addEventListener('change', function () {
        const searchValue = document.getElementById('search-value');
        const searchType = this.value;

        if (searchType === 'fecha_emision' || searchType === 'fecha_servicio') {
            searchValue.type = 'date';
            searchValue.placeholder = 'Selecciona una fecha';
        } else {
            searchValue.type = 'text';
            searchValue.placeholder = 'Introduce el valor a buscar...';
        }
    });

    // ✅ VERIFICAR QUE EL ELEMENTO EXISTE ANTES DE AÑADIR EVENT LISTENER
    const agencySelect = document.getElementById('agency-filtro');
    if (agencySelect) {
        agencySelect.addEventListener('change', function () {
            if (document.getElementById('fecha-inicio').value && document.getElementById('fecha-fin').value) {
                loadReservationsByDateWithFilters();
            }
        });
        console.log('✅ Evento de cambio de agencia configurado');
    } else {
        console.warn('⚠️ Elemento agency-filtro no encontrado al configurar eventos');
    }

    // Permitir búsqueda con Enter
    document.getElementById('search-value').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            searchReservations();
        }
    });

    // ✅ EVENTOS PARA FILTROS
    document.getElementById('tipo-fecha').addEventListener('change', function () {
        const label = this.value === 'compra' ? 'Fecha de Compra' : 'Fecha de Servicio';
        console.log(`Filtro cambiado a: ${label}`);
    });

    // Eventos para enter en campos de fecha
    document.getElementById('fecha-inicio').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            loadReservationsByDateWithFilters();
        }
    });

    document.getElementById('fecha-fin').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            loadReservationsByDateWithFilters();
        }
    });

    // Eventos para cambio automático al seleccionar fechas
    document.getElementById('fecha-inicio').addEventListener('change', function () {
        if (this.value && document.getElementById('fecha-fin').value) {
            loadReservationsByDateWithFilters();
        }
    });

    document.getElementById('fecha-fin').addEventListener('change', function () {
        if (this.value && document.getElementById('fecha-inicio').value) {
            loadReservationsByDateWithFilters();
        }
    });

    // Evento para cambio de filtro de estado
    document.getElementById('estado-filtro').addEventListener('change', function () {
        if (document.getElementById('fecha-inicio').value && document.getElementById('fecha-fin').value) {
            loadReservationsByDateWithFilters();
        }
    });
}

// ✅ FUNCIÓN PARA CAMBIAR PESTAÑAS
function switchTab(tabName) {
    // Ocultar todas las pestañas
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    // Quitar clase active de todos los botones
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Mostrar pestaña seleccionada
    document.getElementById('tab-' + tabName).classList.add('active');

    // Activar botón correspondiente
    event.target.classList.add('active');
}

function loadReservationsByDate(page = 1) {
    // Redirigir a la nueva función con filtros
    loadReservationsByDateWithFilters(page);
}

window.loadReservationsByDateWithFilters = loadReservationsByDateWithFilters;

function renderReservationsReport(data) {
    // Mostrar estadísticas
    const statsHtml = `
        <div class="stats-cards">
            <div class="stat-card">
                <h4>Total Reservas</h4>
                <div class="stat-number">${data.stats.total_reservas || 0}</div>
            </div>
            <div class="stat-card">
                <h4>Adultos</h4>
                <div class="stat-number">${data.stats.total_adultos || 0}</div>
            </div>
            <div class="stat-card">
                <h4>Residentes</h4>
                <div class="stat-number">${data.stats.total_residentes || 0}</div>
            </div>
            <div class="stat-card">
                <h4>Niños (5-12)</h4>
                <div class="stat-number">${data.stats.total_ninos_5_12 || 0}</div>
            </div>
            <div class="stat-card">
                <h4>Niños (-5)</h4>
                <div class="stat-number">${data.stats.total_ninos_menores || 0}</div>
            </div>
            <div class="stat-card">
                <h4>Ingresos Totales</h4>
                <div class="stat-number">${parseFloat(data.stats.ingresos_totales || 0).toFixed(2)}€</div>
            </div>
        </div>
    `;

    document.getElementById('reservations-stats').innerHTML = statsHtml;
    document.getElementById('reservations-stats').style.display = 'block';

    // Mostrar tabla de reservas
    let tableHtml = `
        <div class="table-header">
            <h4>Reservas del ${data.fecha_inicio} al ${data.fecha_fin}</h4>
        </div>
        <table class="reservations-table-data">
            <thead>
                <tr>
                    <th>Localizador</th>
                    <th>Fecha Servicio</th>
                    <th>Hora</th>
                    <th>Cliente</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Personas</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (data.reservas && data.reservas.length > 0) {
        data.reservas.forEach(reserva => {
            const fechaFormateada = new Date(reserva.fecha).toLocaleDateString('es-ES');
            const personasDetalle = `A:${reserva.adultos} R:${reserva.residentes} N:${reserva.ninos_5_12} B:${reserva.ninos_menores}`;

            tableHtml += `
                <tr>
                    <td><strong>${reserva.localizador}</strong></td>
                    <td>${fechaFormateada}</td>
                    <td>${reserva.hora}</td>
                    <td>${reserva.nombre} ${reserva.apellidos}</td>
                    <td>${reserva.email}</td>
                    <td>${reserva.telefono}</td>
                    <td title="Adultos: ${reserva.adultos}, Residentes: ${reserva.residentes}, Niños 5-12: ${reserva.ninos_5_12}, Menores: ${reserva.ninos_menores}">${personasDetalle}</td>
                    <td><strong>${parseFloat(reserva.precio_final).toFixed(2)}€</strong></td>
                    <td><span class="status-badge status-${reserva.estado}">${reserva.estado}</span></td>
                    <td>
            <button class="btn-small btn-info" onclick="showReservationDetails(${reserva.id})" title="Ver detalles">👁️</button>
    <button class="btn-small btn-edit" onclick="showEditEmailModal(${reserva.id}, '${reserva.email}')" title="Editar email">✏️</button>
    <button class="btn-small btn-warning" onclick="showEditReservationModal(${reserva.id})" title="Editar fecha/horario">📅</button>
    <button class="btn-small btn-primary" onclick="resendConfirmationEmail(${reserva.id})" title="Reenviar confirmación">📧</button>
        ${reserva.estado !== 'cancelada' ?
                    `<button class="btn-small btn-danger" onclick="showCancelReservationModal(${reserva.id}, '${reserva.localizador}')" title="Cancelar reserva">❌</button>` :
                    `<span class="btn-small" style="background: #6c757d; color: white;">CANCELADA</span>`
                }
    </td>
                </tr>
            `;
        });
    } else {
        tableHtml += `
            <tr>
                <td colspan="10" style="text-align: center; padding: 40px; color: #666;">
                    No se encontraron reservas en este período
                </td>
            </tr>
        `;
    }

    tableHtml += `
            </tbody>
        </table>
    `;

    document.getElementById('reservations-list').innerHTML = tableHtml;

    // Mostrar paginación
    if (data.pagination && data.pagination.total_pages > 1) {
        renderPagination(data.pagination);
    } else {
        document.getElementById('reservations-pagination').innerHTML = '';
    }
}

function renderPagination(pagination) {
    let paginationHtml = '<div class="pagination">';

    // Botón anterior
    if (pagination.current_page > 1) {
        paginationHtml += `<button class="btn-pagination" onclick="loadReservationsByDate(${pagination.current_page - 1})">« Anterior</button>`;
    }

    // Números de página
    for (let i = 1; i <= pagination.total_pages; i++) {
        if (i === pagination.current_page) {
            paginationHtml += `<button class="btn-pagination active">${i}</button>`;
        } else {
            paginationHtml += `<button class="btn-pagination" onclick="loadReservationsByDate(${i})">${i}</button>`;
        }
    }

    // Botón siguiente
    if (pagination.current_page < pagination.total_pages) {
        paginationHtml += `<button class="btn-pagination" onclick="loadReservationsByDate(${pagination.current_page + 1})">Siguiente »</button>`;
    }

    paginationHtml += `</div>
        <div class="pagination-info">
            Página ${pagination.current_page} de ${pagination.total_pages} 
            (${pagination.total_items} reservas total)
        </div>`;

    document.getElementById('reservations-pagination').innerHTML = paginationHtml;
}



function searchReservations() {
    const searchType = document.getElementById('search-type').value;
    const searchValue = document.getElementById('search-value').value.trim();

    if (!searchValue) {
        alert('Por favor, introduce un valor para buscar');
        return;
    }

    document.getElementById('search-results').innerHTML = '<div class="loading">Buscando reservas...</div>';

    const formData = new FormData();
    formData.append('action', 'search_reservations');
    formData.append('search_type', searchType);
    formData.append('search_value', searchValue);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderSearchResults(data.data);
            } else {
                document.getElementById('search-results').innerHTML =
                    '<div class="error">Error: ' + data.data + '</div>';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('search-results').innerHTML =
                '<div class="error">Error de conexión</div>';
        });
}


function renderSearchResults(data) {
    let resultsHtml = `
        <div class="search-header">
            <h4>Resultados de búsqueda: ${data.total_found} reservas encontradas</h4>
            <p>Búsqueda por <strong>${data.search_type}</strong>: "${data.search_value}"</p>
        </div>
    `;

    if (data.reservas && data.reservas.length > 0) {
        resultsHtml += `
            <table class="search-results-table">
                <thead>
                    <tr>
                        <th>Localizador</th>
                        <th>Fecha Servicio</th>
                        <th>Cliente</th>
                        <th>Email</th>
                        <th>Teléfono</th>
                        <th>Personas</th>
                        <th>Total</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.reservas.forEach(reserva => {
            const fechaFormateada = new Date(reserva.fecha).toLocaleDateString('es-ES');
            const personasDetalle = `A:${reserva.adultos} R:${reserva.residentes} N:${reserva.ninos_5_12} B:${reserva.ninos_menores}`;

            resultsHtml += `
                <tr>
                    <td><strong>${reserva.localizador}</strong></td>
                    <td>${fechaFormateada}</td>
                    <td>${reserva.nombre} ${reserva.apellidos}</td>
                    <td>${reserva.email}</td>
                    <td>${reserva.telefono}</td>
                    <td title="Adultos: ${reserva.adultos}, Residentes: ${reserva.residentes}, Niños 5-12: ${reserva.ninos_5_12}, Menores: ${reserva.ninos_menores}">${personasDetalle}</td>
                    <td><strong>${parseFloat(reserva.precio_final).toFixed(2)}€</strong></td>
                    <td>
<button class="btn-small btn-info" onclick="showReservationDetails(${reserva.id})" title="Ver detalles">👁️</button>

<button class="btn-small btn-warning" onclick="showEditReservationModal(${reserva.id})" title="Editar fecha/horario">📅</button>
<button class="btn-small btn-primary" onclick="resendConfirmationEmail(${reserva.id})" title="Reenviar confirmación">📧</button>
<!-- ✅ AÑADIR TAMBIÉN AQUÍ -->
<button class="btn-small btn-success" onclick="downloadTicketPDF(${reserva.id}, '${reserva.localizador}')" title="Descargar PDF">📄</button>
${reserva.estado !== 'cancelada' ?
                    `<button class="btn-small btn-danger" onclick="showCancelReservationModal(${reserva.id}, '${reserva.localizador}')" title="Cancelar reserva">❌</button>` :
                    `<span class="btn-small" style="background: #6c757d; color: white;">CANCELADA</span>`
                }
    </td>
                </tr>
            `;
        });

        resultsHtml += `
                </tbody>
            </table>
        `;
    } else {
        resultsHtml += `
            <div class="no-results">
                <p>No se encontraron reservas con los criterios especificados.</p>
            </div>
        `;
    }

    document.getElementById('search-results').innerHTML = resultsHtml;
}


function showReservationDetails(reservaId) {
    const formData = new FormData();
    formData.append('action', 'get_reservation_details');
    formData.append('reserva_id', reservaId);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderReservationDetails(data.data);
                document.getElementById('reservationDetailsModal').style.display = 'block';
            } else {
                alert('Error cargando detalles: ' + data.data);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error de conexión');
        });
}


function renderReservationDetails(reserva) {
    const fechaServicio = new Date(reserva.fecha).toLocaleDateString('es-ES');
    const fechaCreacion = new Date(reserva.created_at).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // ✅ FECHA DE ACTUALIZACIÓN SI EXISTE
    let fechaActualizacion = '';
    if (reserva.updated_at && reserva.updated_at !== reserva.created_at) {
        const fechaUpdate = new Date(reserva.updated_at).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        fechaActualizacion = `
            <p><strong>Última actualización:</strong> ${fechaUpdate}</p>
        `;
    }

    let descuentoInfo = '';
    if (reserva.regla_descuento_aplicada) {
        descuentoInfo = `
            <div class="detail-section">
                <h4>💰 Información de Descuento</h4>
                <p><strong>Regla aplicada:</strong> ${reserva.regla_descuento_aplicada.rule_name}</p>
                <p><strong>Porcentaje:</strong> ${reserva.regla_descuento_aplicada.discount_percentage}%</p>
                <p><strong>Mínimo personas:</strong> ${reserva.regla_descuento_aplicada.minimum_persons}</p>
            </div>
        `;
    }

    const detailsHtml = `
        <div class="reservation-details">
            <div class="details-grid">
                <div class="detail-section">
                    <h4>📋 Información General</h4>
                    <p><strong>Localizador:</strong> ${reserva.localizador}</p>
                    <p><strong>Estado:</strong> <span class="status-badge status-${reserva.estado}">${reserva.estado.toUpperCase()}</span></p>
                    <p><strong>Fecha de servicio:</strong> ${fechaServicio}</p>
                    <p><strong>Hora:</strong> ${reserva.hora}</p>
                    <p><strong>Fecha de compra:</strong> ${fechaCreacion}</p>
                    ${fechaActualizacion}
                </div>
                
                <div class="detail-section">
                    <h4>👤 Datos del Cliente</h4>
                    <p><strong>Nombre:</strong> ${reserva.nombre} ${reserva.apellidos}</p>
                    <p><strong>Email:</strong> ${reserva.email}</p>
                    <p><strong>Teléfono:</strong> ${reserva.telefono}</p>
                </div>
                
                <div class="detail-section">
                    <h4>👥 Distribución de Personas</h4>
                    <p><strong>Adultos:</strong> ${reserva.adultos}</p>
                    <p><strong>Residentes:</strong> ${reserva.residentes}</p>
                    <p><strong>Niños (5-12 años):</strong> ${reserva.ninos_5_12}</p>
                    <p><strong>Niños menores (gratis):</strong> ${reserva.ninos_menores}</p>
                    <p><strong>Total personas con plaza:</strong> ${reserva.total_personas}</p>
                </div>
                
                <div class="detail-section">
                    <h4>💰 Información de Precios</h4>
                    <p><strong>Precio base:</strong> ${parseFloat(reserva.precio_base).toFixed(2)}€</p>
                    <p><strong>Descuento total:</strong> ${parseFloat(reserva.descuento_total).toFixed(2)}€</p>
                    <p><strong>Precio final:</strong> <span class="price-final">${parseFloat(reserva.precio_final).toFixed(2)}€</span></p>
                    <p><strong>Método de pago:</strong> ${reserva.metodo_pago}</p>
                </div>
            </div>
            
            ${descuentoInfo}
            
            <div class="detail-actions">
                <button class="btn-primary" onclick="showEditEmailModal(${reserva.id}, '${reserva.email}')">✏️ Editar Email</button>
                <button class="btn-secondary" onclick="resendConfirmationEmail(${reserva.id})">📧 Reenviar Confirmación</button>
            </div>
        </div>
    `;

    document.getElementById('reservationModalTitle').textContent = `Detalles de Reserva - ${reserva.localizador}`;
    document.getElementById('reservation-details-content').innerHTML = detailsHtml;
}

function showEditEmailModal(reservaId, currentEmail) {
    document.getElementById('edit-reserva-id').value = reservaId;
    document.getElementById('current-email').value = currentEmail;
    document.getElementById('new-email').value = currentEmail;
    document.getElementById('editEmailModal').style.display = 'block';
}


function updateReservationEmail() {
    const reservaId = document.getElementById('edit-reserva-id').value;
    const newEmail = document.getElementById('new-email').value;

    if (!newEmail || !newEmail.includes('@')) {
        alert('Por favor, introduce un email válido');
        return;
    }

    const formData = new FormData();
    formData.append('action', 'update_reservation_email');
    formData.append('reserva_id', reservaId);
    formData.append('new_email', newEmail);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Email actualizado correctamente');
                closeEditEmailModal();
                // Recargar la lista actual
                const activeTab = document.querySelector('.tab-btn.active').onclick.toString();
                if (activeTab.includes('reservations')) {
                    loadReservationsByDate();
                } else if (activeTab.includes('search')) {
                    searchReservations();
                }
            } else {
                alert('Error actualizando email: ' + data.data);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error de conexión');
        });
}

// ✅ FUNCIÓN PARA REENVIAR EMAIL DE CONFIRMACIÓN
function resendConfirmationEmail(reservaId) {
    if (!confirm('¿Reenviar email de confirmación al cliente?')) {
        return;
    }

    const formData = new FormData();
    formData.append('action', 'resend_confirmation_email');
    formData.append('reserva_id', reservaId);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(data.data);
            } else {
                alert('Error reenviando email: ' + data.data);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error de conexión');
        });
}

// ✅ FUNCIÓN PARA CARGAR ESTADÍSTICAS POR RANGO
function loadRangeStats(rangeType) {
    document.getElementById('analytics-results').innerHTML = '<div class="loading">Cargando análisis...</div>';

    const formData = new FormData();
    formData.append('action', 'get_date_range_stats');
    formData.append('range_type', rangeType);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderAnalyticsResults(data.data);
            } else {
                document.getElementById('analytics-results').innerHTML =
                    '<div class="error">Error: ' + data.data + '</div>';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('analytics-results').innerHTML =
                '<div class="error">Error de conexión</div>';
        });
}

// ✅ FUNCIÓN PARA CARGAR ESTADÍSTICAS PERSONALIZADAS
function loadCustomRangeStats() {
    const fechaInicio = document.getElementById('custom-fecha-inicio').value;
    const fechaFin = document.getElementById('custom-fecha-fin').value;

    if (!fechaInicio || !fechaFin) {
        alert('Por favor, selecciona ambas fechas');
        return;
    }

    document.getElementById('analytics-results').innerHTML = '<div class="loading">Cargando análisis...</div>';

    const formData = new FormData();
    formData.append('action', 'get_date_range_stats');
    formData.append('range_type', 'custom');
    formData.append('fecha_inicio', fechaInicio);
    formData.append('fecha_fin', fechaFin);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderAnalyticsResults(data.data);
            } else {
                document.getElementById('analytics-results').innerHTML =
                    '<div class="error">Error: ' + data.data + '</div>';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('analytics-results').innerHTML =
                '<div class="error">Error de conexión</div>';
        });
}

// ✅ FUNCIÓN PARA RENDERIZAR RESULTADOS DE ANÁLISIS
function renderAnalyticsResults(data) {
    const stats = data.stats;
    const promedioPersonasPorReserva = stats.total_reservas > 0 ?
        (parseFloat(stats.total_personas_con_plaza) / parseFloat(stats.total_reservas)).toFixed(1) : 0;

    let analyticsHtml = `
        <div class="analytics-summary">
            <h4>📊 Resumen del Período: ${data.fecha_inicio} al ${data.fecha_fin}</h4>
            
            <div class="analytics-stats-grid">
                <div class="analytics-stat-card">
                    <h5>Total Reservas</h5>
                    <div class="analytics-stat-number">${stats.total_reservas || 0}</div>
                </div>
                <div class="analytics-stat-card">
                    <h5>Ingresos Totales</h5>
                    <div class="analytics-stat-number">${parseFloat(stats.ingresos_totales || 0).toFixed(2)}€</div>
                </div>
                <div class="analytics-stat-card">
                    <h5>Descuentos Aplicados</h5>
                    <div class="analytics-stat-number">${parseFloat(stats.descuentos_totales || 0).toFixed(2)}€</div>
                </div>
                <div class="analytics-stat-card">
                    <h5>Precio Promedio</h5>
                    <div class="analytics-stat-number">${parseFloat(stats.precio_promedio || 0).toFixed(2)}€</div>
                </div>
            </div>
            
            <div class="people-breakdown">
                <h5>👥 Distribución de Personas</h5>
                <div class="people-stats">
                    <div class="people-stat">
                        <span class="people-label">Adultos:</span>
                        <span class="people-number">${stats.total_adultos || 0}</span>
                    </div>
                    <div class="people-stat">
                        <span class="people-label">Residentes:</span>
                        <span class="people-number">${stats.total_residentes || 0}</span>
                    </div>
                    <div class="people-stat">
                        <span class="people-label">Niños (5-12):</span>
                        <span class="people-number">${stats.total_ninos_5_12 || 0}</span>
                    </div>
                    <div class="people-stat">
                        <span class="people-label">Niños menores:</span>
                        <span class="people-number">${stats.total_ninos_menores || 0}</span>
                    </div>
                    <div class="people-stat total">
                        <span class="people-label">Total con plaza:</span>
                        <span class="people-number">${stats.total_personas_con_plaza || 0}</span>
                    </div>
                </div>
                <p><strong>Promedio personas por reserva:</strong> ${promedioPersonasPorReserva}</p>
            </div>
        </div>
    `;

    // Agregar gráfico simple de reservas por día si hay datos
    if (data.reservas_por_dia && data.reservas_por_dia.length > 0) {
        analyticsHtml += `
            <div class="daily-chart">
                <h5>📈 Reservas por Día</h5>
                <div class="chart-container">
        `;

        data.reservas_por_dia.forEach(dia => {
            const fecha = new Date(dia.fecha).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit'
            });
            analyticsHtml += `
                <div class="chart-bar">
                    <div class="bar-value">${dia.reservas_dia}</div>
                    <div class="bar" style="height: ${Math.max(dia.reservas_dia * 20, 10)}px;"></div>
                    <div class="bar-label">${fecha}</div>
                </div>
            `;
        });

        analyticsHtml += `
                </div>
            </div>
        `;
    }

    document.getElementById('analytics-results').innerHTML = analyticsHtml;
}

function showQuickStatsModal() {
    document.getElementById('quick-stats-content').innerHTML = '<div class="loading">📊 Cargando estadísticas...</div>';
    document.getElementById('quickStatsModal').style.display = 'block';

    // Cargar estadísticas
    loadQuickStats();
}


function loadQuickStats() {
    const formData = new FormData();
    formData.append('action', 'get_quick_stats');
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderQuickStats(data.data);
            } else {
                document.getElementById('quick-stats-content').innerHTML =
                    '<div class="error">❌ Error cargando estadísticas: ' + data.data + '</div>';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('quick-stats-content').innerHTML =
                '<div class="error">❌ Error de conexión</div>';
        });
}


function renderQuickStats(stats) {
    const hoy = new Date().toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Determinar color y emoji para el crecimiento
    let crecimientoColor = '#28a745';
    let crecimientoEmoji = '📈';
    let crecimientoTexto = 'Crecimiento';

    if (stats.ingresos.crecimiento < 0) {
        crecimientoColor = '#dc3545';
        crecimientoEmoji = '📉';
        crecimientoTexto = 'Decrecimiento';
    } else if (stats.ingresos.crecimiento === 0) {
        crecimientoColor = '#ffc107';
        crecimientoEmoji = '➡️';
        crecimientoTexto = 'Sin cambios';
    }

    let html = `
        <div class="quick-stats-container">
            <!-- Resumen Ejecutivo -->
            <div class="stats-summary-header">
                <h4>📊 Resumen Ejecutivo - ${hoy}</h4>
            </div>
            
            <!-- Métricas Principales -->
            <div class="main-metrics">
                <div class="metric-card today">
                    <div class="metric-icon">🎫</div>
                    <div class="metric-content">
                        <div class="metric-number">${stats.hoy.reservas}</div>
                        <div class="metric-label">Reservas Hoy</div>
                    </div>
                </div>
                
                <div class="metric-card revenue">
                    <div class="metric-icon">💰</div>
                    <div class="metric-content">
                        <div class="metric-number">${parseFloat(stats.ingresos.mes_actual).toFixed(2)}€</div>
                        <div class="metric-label">Ingresos Este Mes</div>
                    </div>
                </div>
                
                <div class="metric-card growth" style="border-left-color: ${crecimientoColor}">
                    <div class="metric-icon">${crecimientoEmoji}</div>
                    <div class="metric-content">
                        <div class="metric-number" style="color: ${crecimientoColor}">
                            ${stats.ingresos.crecimiento > 0 ? '+' : ''}${stats.ingresos.crecimiento.toFixed(1)}%
                        </div>
                        <div class="metric-label">${crecimientoTexto} vs Mes Pasado</div>
                    </div>
                </div>
                
                <div class="metric-card occupancy">
                    <div class="metric-icon">🚌</div>
                    <div class="metric-content">
                        <div class="metric-number">${stats.ocupacion.porcentaje.toFixed(1)}%</div>
                        <div class="metric-label">Ocupación Media</div>
                    </div>
                </div>
            </div>
            
            <!-- Información Detallada -->
            <div class="detailed-stats">
                <!-- Top Días -->
                <div class="stat-section">
                    <h5>🏆 Top Días con Más Reservas</h5>
                    <div class="top-days">
    `;

    if (stats.top_dias && stats.top_dias.length > 0) {
        stats.top_dias.forEach((dia, index) => {
            const fecha = new Date(dia.fecha).toLocaleDateString('es-ES', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit'
            });
            const medalla = ['🥇', '🥈', '🥉'][index] || '🏅';

            html += `
                <div class="top-day-item">
                    <span class="medal">${medalla}</span>
                    <span class="date">${fecha}</span>
                    <span class="count">${dia.total_reservas} reservas</span>
                    <span class="people">${dia.total_personas} personas</span>
                </div>
            `;
        });
    } else {
        html += '<p class="no-data">📊 No hay datos suficientes este mes</p>';
    }

    html += `
                    </div>
                </div>
                
                <!-- Cliente Frecuente -->
                <div class="stat-section">
                    <h5>⭐ Cliente Más Frecuente (último mes)</h5>
    `;

    if (stats.cliente_frecuente && stats.cliente_frecuente.total_reservas > 1) {
        html += `
            <div class="frequent-customer">
                <div class="customer-info">
                    <strong>${stats.cliente_frecuente.nombre_completo}</strong>
                    <span class="email">${stats.cliente_frecuente.email}</span>
                </div>
                <div class="customer-stats">
                    <span class="reservas-count">${stats.cliente_frecuente.total_reservas} reservas</span>
                </div>
            </div>
        `;
    } else {
        html += '<p class="no-data">👥 No hay clientes frecuentes aún</p>';
    }

    html += `
                </div>
                
                <!-- Distribución de Clientes -->
                <div class="stat-section">
                    <h5>👥 Distribución de Clientes (Este Mes)</h5>
                    <div class="client-distribution">
    `;

    if (stats.tipos_cliente) {
        const total = parseInt(stats.tipos_cliente.total_adultos || 0) +
            parseInt(stats.tipos_cliente.total_residentes || 0) +
            parseInt(stats.tipos_cliente.total_ninos || 0) +
            parseInt(stats.tipos_cliente.total_bebes || 0);

        if (total > 0) {
            html += `
                <div class="client-type">
                    <span class="type-icon">👨‍💼</span>
                    <span class="type-label">Adultos:</span>
                    <span class="type-count">${stats.tipos_cliente.total_adultos || 0}</span>
                </div>
                <div class="client-type">
                    <span class="type-icon">🏠</span>
                    <span class="type-label">Residentes:</span>
                    <span class="type-count">${stats.tipos_cliente.total_residentes || 0}</span>
                </div>
                <div class="client-type">
                    <span class="type-icon">👶</span>
                    <span class="type-label">Niños (5-12):</span>
                    <span class="type-count">${stats.tipos_cliente.total_ninos || 0}</span>
                </div>
                <div class="client-type">
                    <span class="type-icon">🍼</span>
                    <span class="type-label">Bebés (gratis):</span>
                    <span class="type-count">${stats.tipos_cliente.total_bebes || 0}</span>
                </div>
            `;
        } else {
            html += '<p class="no-data">📊 No hay reservas este mes</p>';
        }
    }

    html += `
                    </div>
                </div>
                
                <!-- Servicios con Alta Ocupación -->
                <div class="stat-section">
                    <h5>⚠️ Próximos Servicios con Alta Ocupación (>80%)</h5>
                    <div class="high-occupancy">
    `;

    if (stats.servicios_alta_ocupacion && stats.servicios_alta_ocupacion.length > 0) {
        stats.servicios_alta_ocupacion.forEach(servicio => {
            const fecha = new Date(servicio.fecha).toLocaleDateString('es-ES', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit'
            });
            const ocupacion = parseFloat(servicio.ocupacion).toFixed(1);
            const ocupadas = servicio.plazas_totales - servicio.plazas_disponibles;

            html += `
                <div class="service-alert">
                    <span class="service-date">${fecha} ${servicio.hora}</span>
                    <span class="service-occupancy">${ocupacion}% ocupado</span>
                    <span class="service-seats">${ocupadas}/${servicio.plazas_totales} plazas</span>
                </div>
            `;
        });
    } else {
        html += '<p class="no-data">✅ No hay servicios con alta ocupación</p>';
    }

    html += `
                    </div>
                </div>
            </div>
            
            <!-- Botón de Actualizar -->
            <div class="stats-actions">
                <button class="btn-primary" onclick="loadQuickStats()">🔄 Actualizar Estadísticas</button>
            </div>
        </div>
    `;

    document.getElementById('quick-stats-content').innerHTML = html;
}


function closeQuickStatsModal() {
    document.getElementById('quickStatsModal').style.display = 'none';
}

function closeReservationDetailsModal() {
    document.getElementById('reservationDetailsModal').style.display = 'none';
}

function closeEditEmailModal() {
    document.getElementById('editEmailModal').style.display = 'none';
}


function showCancelReservationModal(reservaId, localizador) {
    // Crear modal si no existe
    if (!document.getElementById('cancelReservationModal')) {
        const modalHtml = `
            <div id="cancelReservationModal" class="modal" style="display: none;">
                <div class="modal-content" style="max-width: 500px;">
                    <span class="close" onclick="closeCancelReservationModal()">&times;</span>
                    <h3 style="color: #dc3545;">⚠️ Cancelar Reserva</h3>
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ffc107;">
                        <p style="margin: 0; color: #856404; font-weight: bold;">
                            ¿Estás seguro de que quieres cancelar la reserva <strong id="cancel-localizador"></strong>?
                        </p>
                        <p style="margin: 5px 0 0 0; color: #856404; font-size: 14px;">
                            Esta acción NO se puede deshacer y se enviarán notificaciones automáticas.
                        </p>
                    </div>
                    <form id="cancelReservationForm">
                        <input type="hidden" id="cancel-reserva-id">
                        <div class="form-group">
                            <label for="motivo-cancelacion" style="font-weight: bold; color: #495057;">
                                Motivo de cancelación (opcional):
                            </label>
                            <textarea id="motivo-cancelacion" name="motivo_cancelacion" 
                                      rows="3" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;" 
                                      placeholder="Ej: Problema técnico, Cancelación por parte del cliente, etc."></textarea>
                        </div>
                        <div class="form-actions" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                            <button type="button" class="btn-secondary" onclick="closeCancelReservationModal()">
                                Cancelar
                            </button>
                            <button type="submit" class="btn-danger" style="background: #dc3545; color: white;">
                                ❌ Confirmar Cancelación
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Añadir evento al formulario
        document.getElementById('cancelReservationForm').addEventListener('submit', function (e) {
            e.preventDefault();
            processCancelReservation();
        });
    }

    // Configurar modal
    document.getElementById('cancel-reserva-id').value = reservaId;
    document.getElementById('cancel-localizador').textContent = localizador;
    document.getElementById('motivo-cancelacion').value = '';
    document.getElementById('cancelReservationModal').style.display = 'block';
}

/**
 * Cerrar modal de cancelación
 */
function closeCancelReservationModal() {
    document.getElementById('cancelReservationModal').style.display = 'none';
}

/**
 * Procesar cancelación de reserva
 */
function processCancelReservation() {
    const reservaId = document.getElementById('cancel-reserva-id').value;
    const motivo = document.getElementById('motivo-cancelacion').value || 'Cancelación administrativa';

    if (!confirm('¿Estás COMPLETAMENTE SEGURO de cancelar esta reserva?\n\n⚠️ ESTA ACCIÓN NO SE PUEDE DESHACER ⚠️')) {
        return;
    }

    // Deshabilitar botón
    const submitBtn = document.querySelector('#cancelReservationForm button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Cancelando...';

    const formData = new FormData();
    formData.append('action', 'cancel_reservation');
    formData.append('reserva_id', reservaId);
    formData.append('motivo_cancelacion', motivo);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            // Rehabilitar botón
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;

            if (data.success) {
                alert('✅ ' + data.data);
                closeCancelReservationModal();

                // Recargar la lista actual
                const activeTab = document.querySelector('.tab-btn.active');
                if (activeTab && activeTab.textContent.includes('Reservas')) {
                    loadReservationsByDate();
                } else if (activeTab && activeTab.textContent.includes('Buscar')) {
                    searchReservations();
                }
            } else {
                alert('❌ Error: ' + data.data);
            }
        })
        .catch(error => {
            // Rehabilitar botón
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;

            console.error('Error:', error);
            alert('❌ Error de conexión al cancelar la reserva');
        });
}

function showLoadingInContent() {
    const targetElement = document.querySelector('.dashboard-content') || document.getElementById('dashboard-content');

    if (targetElement) {
        targetElement.innerHTML = '<div class="loading">Cargando reserva rápida...</div>';
    } else {
        console.log('Loading reserva rápida...');
    }
}

function showErrorInContent(message) {
    const targetElement = document.querySelector('.dashboard-content') || document.getElementById('dashboard-content');

    if (targetElement) {
        targetElement.innerHTML = `<div class="error">${message}</div>`;
    } else {
        alert('Error: ' + message);
    }
}

function loadAdminReservaRapida() {
    console.log('=== CARGANDO RESERVA RÁPIDA ADMIN ===');

    showLoadingInContent();

    jQuery.ajax({
        url: reservasAjax.ajax_url,
        type: 'POST',
        data: {
            action: 'get_reserva_rapida_form',
            nonce: reservasAjax.nonce
        },
        success: function (response) {
            if (response.success) {
                if (response.data.action === 'initialize_admin_reserva_rapida') {
                    // Inicializar reserva rápida con flujo de calendario
                    initAdminReservaRapida();
                } else {
                    // Fallback al método anterior si es necesario
                    document.body.innerHTML = response.data;
                }
            } else {
                showErrorInContent('Error cargando reserva rápida: ' + response.data);
            }
        },
        error: function (xhr, status, error) {
            console.error('Error AJAX:', error);
            showErrorInContent('Error de conexión cargando reserva rápida');
        }
    });
}



// Variables globales para reserva rápida admin
let adminCurrentDate = new Date();
let adminSelectedDate = null;
let adminSelectedServiceId = null;
let adminServicesData = {};
let adminCurrentStep = 1;
let adminDiasAnticiapcionMinima = 1;

function initAdminQuickReservation() {
    console.log('=== INICIALIZANDO RESERVA RÁPIDA ADMIN ===');

    // Cargar configuración y luego calendario
    loadAdminSystemConfiguration().then(() => {
        loadAdminCalendar();
        setupAdminEventListeners();
    });
}

function loadAdminSystemConfiguration() {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('action', 'get_configuration');
        formData.append('nonce', reservasAjax.nonce);

        fetch(reservasAjax.ajax_url, {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const config = data.data;
                    adminDiasAnticiapcionMinima = parseInt(config.servicios?.dias_anticipacion_minima?.value || '1');
                    console.log('Admin: Días de anticipación mínima cargados:', adminDiasAnticiapcionMinima);
                    resolve();
                } else {
                    console.warn('Admin: No se pudo cargar configuración, usando valores por defecto');
                    adminDiasAnticiapcionMinima = 1;
                    resolve();
                }
            })
            .catch(error => {
                console.error('Error cargando configuración:', error);
                adminDiasAnticiapcionMinima = 1;
                resolve();
            });
    });
}

function setupAdminEventListeners() {
    // Navegación del calendario
    document.getElementById('admin-prev-month').addEventListener('click', function () {
        adminCurrentDate.setMonth(adminCurrentDate.getMonth() - 1);
        loadAdminCalendar();
    });

    document.getElementById('admin-next-month').addEventListener('click', function () {
        adminCurrentDate.setMonth(adminCurrentDate.getMonth() + 1);
        loadAdminCalendar();
    });

    // Selección de horario
    document.getElementById('admin-horarios-select').addEventListener('change', function () {
        adminSelectedServiceId = this.value;
        if (adminSelectedServiceId) {
            document.getElementById('admin-btn-siguiente').disabled = false;
            loadAdminPrices();
        } else {
            document.getElementById('admin-btn-siguiente').disabled = true;
            document.getElementById('admin-total-price').textContent = '0€';
        }
    });

    ['admin-adultos', 'admin-residentes', 'admin-ninos-5-12', 'admin-ninos-menores'].forEach(id => {
        const input = document.getElementById(id);

        // Múltiples eventos para asegurar detección
        ['input', 'change', 'keyup', 'blur'].forEach(eventType => {
            input.addEventListener(eventType, function () {
                setTimeout(() => {
                    calculateAdminTotalPrice();
                    validateAdminPersonSelectionForNext();
                }, 100);
            });
        });
    });
}

function validateAdminPersonSelectionForNext() {
    const adultos = parseInt(document.getElementById('admin-adultos').value) || 0;
    const residentes = parseInt(document.getElementById('admin-residentes').value) || 0;
    const ninos512 = parseInt(document.getElementById('admin-ninos-5-12').value) || 0;
    const ninosMenores = parseInt(document.getElementById('admin-ninos-menores').value) || 0;

    const totalAdults = adultos + residentes;
    const totalChildren = ninos512 + ninosMenores;
    const totalPersonas = totalAdults + totalChildren;

    console.log('=== VALIDACIÓN PARA SIGUIENTE ===');
    console.log('Adultos:', adultos, 'Residentes:', residentes, 'Niños 5-12:', ninos512, 'Menores:', ninosMenores);
    console.log('Total personas:', totalPersonas, 'Total adultos:', totalAdults);

    // Validar que hay al menos una persona
    if (totalPersonas === 0) {
        console.log('❌ No hay personas seleccionadas');
        document.getElementById('admin-btn-siguiente').disabled = true;
        return false;
    }

    // Validar que si hay niños, debe haber al menos un adulto
    if (totalChildren > 0 && totalAdults === 0) {
        console.log('❌ Hay niños pero no adultos');
        alert('Debe haber al menos un adulto si hay niños en la reserva.');
        document.getElementById('admin-ninos-5-12').value = 0;
        document.getElementById('admin-ninos-menores').value = 0;
        calculateAdminTotalPrice();
        document.getElementById('admin-btn-siguiente').disabled = true;
        return false;
    }

    // Si llegamos aquí, todo está bien
    console.log('✅ Validación correcta - habilitando botón siguiente');
    document.getElementById('admin-btn-siguiente').disabled = false;
    return true;
}

function validateAdminPersonSelection() {
    const adultos = parseInt(document.getElementById('admin-adultos').value) || 0;
    const residentes = parseInt(document.getElementById('admin-residentes').value) || 0;
    const ninos512 = parseInt(document.getElementById('admin-ninos-5-12').value) || 0;
    const ninosMenores = parseInt(document.getElementById('admin-ninos-menores').value) || 0;

    const totalAdults = adultos + residentes;
    const totalChildren = ninos512 + ninosMenores;

    if (totalChildren > 0 && totalAdults === 0) {
        alert('Debe haber al menos un adulto si hay niños en la reserva.');
        document.getElementById('admin-ninos-5-12').value = 0;
        document.getElementById('admin-ninos-menores').value = 0;
        calculateAdminTotalPrice();
        return false;
    }

    return true;
}

function loadAdminCalendar() {
    updateAdminCalendarHeader();

    const formData = new FormData();
    formData.append('action', 'get_available_services'); // ✅ MISMO ENDPOINT QUE FRONTEND
    formData.append('month', adminCurrentDate.getMonth() + 1);
    formData.append('year', adminCurrentDate.getFullYear());
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                adminServicesData = data.data;
                renderAdminCalendar();
            } else {
                console.error('Error cargando servicios admin:', data.data);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

function updateAdminCalendarHeader() {
    const monthNames = [
        'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];

    const monthYear = monthNames[adminCurrentDate.getMonth()] + ' ' + adminCurrentDate.getFullYear();
    document.getElementById('admin-current-month-year').textContent = monthYear;
}

function renderAdminCalendar() {
    const year = adminCurrentDate.getFullYear();
    const month = adminCurrentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let firstDayOfWeek = firstDay.getDay();
    firstDayOfWeek = (firstDayOfWeek + 6) % 7; // Lunes = 0

    const daysInMonth = lastDay.getDate();
    const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

    let calendarHTML = '';

    // Encabezados de días
    dayNames.forEach(day => {
        calendarHTML += `<div class="calendar-day-header">${day}</div>`;
    });

    // Días del mes anterior
    for (let i = 0; i < firstDayOfWeek; i++) {
        const dayNum = new Date(year, month, -firstDayOfWeek + i + 1).getDate();
        calendarHTML += `<div class="calendar-day other-month">${dayNum}</div>`;
    }

    // Calcular fecha mínima basada en configuración
    const today = new Date();
    const fechaMinima = new Date();
    fechaMinima.setDate(today.getDate() + adminDiasAnticiapcionMinima);

    // Días del mes actual
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayDate = new Date(year, month, day);

        let dayClass = 'calendar-day';
        let clickHandler = '';

        const currentUser = window.reservasUser || {};
        const isSuper = currentUser.role === 'super_admin';
        const isBlockedByAnticipacion = !isSuper && dayDate < fechaMinima;

        if (isBlockedByAnticipacion) {
            dayClass += ' blocked-day';
            clickHandler = `onclick="showBlockedDayMessage()"`;
        }

        if (isBlockedByAnticipacion) {
            dayClass += ' no-disponible';
        } else if (adminServicesData[dateStr] && adminServicesData[dateStr].length > 0) {
            dayClass += ' disponible';
            clickHandler = `onclick="selectAdminDate('${dateStr}')"`;

            // Verificar si algún servicio tiene descuento
            const tieneDescuento = adminServicesData[dateStr].some(service =>
                service.tiene_descuento && parseFloat(service.porcentaje_descuento) > 0
            );

            if (tieneDescuento) {
                dayClass += ' oferta';
            }
        } else {
            dayClass += ' no-disponible';
        }

        if (adminSelectedDate === dateStr) {
            dayClass += ' selected';
        }

        calendarHTML += `<div class="${dayClass}" ${clickHandler}>${day}</div>`;
    }

    document.getElementById('admin-calendar-grid').innerHTML = calendarHTML;
}

function selectAdminDate(dateStr) {
    adminSelectedDate = dateStr;
    adminSelectedServiceId = null;

    // Actualizar visual del calendario
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('selected');
    });
    event.target.classList.add('selected');

    // Cargar horarios disponibles
    loadAdminAvailableSchedules(dateStr);
}

function loadAdminAvailableSchedules(dateStr) {
    const services = adminServicesData[dateStr] || [];

    let optionsHTML = '<option value="">Selecciona un horario</option>';

    services.forEach(service => {
        let descuentoInfo = '';
        if (service.tiene_descuento && parseFloat(service.porcentaje_descuento) > 0) {
            descuentoInfo = ` (${service.porcentaje_descuento}% descuento)`;
        }

        optionsHTML += `<option value="${service.id}">${service.hora} - ${service.plazas_disponibles} plazas disponibles${descuentoInfo}</option>`;
    });

    document.getElementById('admin-horarios-select').innerHTML = optionsHTML;
    document.getElementById('admin-horarios-select').disabled = false;
    document.getElementById('admin-btn-siguiente').disabled = true;
}

function loadAdminPrices() {
    if (!adminSelectedServiceId) return;

    const service = findAdminServiceById(adminSelectedServiceId);
    if (service) {
        document.getElementById('admin-price-adultos').textContent = service.precio_adulto + '€';
        document.getElementById('admin-price-ninos').textContent = service.precio_nino + '€';
        calculateAdminTotalPrice();
    }
}

function findAdminServiceById(serviceId) {
    for (let date in adminServicesData) {
        for (let service of adminServicesData[date]) {
            if (service.id == serviceId) {
                return service;
            }
        }
    }
    return null;
}

function calculateAdminTotalPrice() {
    if (!adminSelectedServiceId) {
        clearAdminPricing();
        return;
    }

    const adultos = parseInt(document.getElementById('admin-adultos').value) || 0;
    const residentes = parseInt(document.getElementById('admin-residentes').value) || 0;
    const ninos512 = parseInt(document.getElementById('admin-ninos-5-12').value) || 0;
    const ninosMenores = parseInt(document.getElementById('admin-ninos-menores').value) || 0;

    const totalPersonas = adultos + residentes + ninos512 + ninosMenores;

    if (totalPersonas === 0) {
        document.getElementById('admin-total-discount').textContent = '';
        document.getElementById('admin-total-price').textContent = '0€';
        document.getElementById('admin-discount-row').style.display = 'none';
        document.getElementById('admin-discount-message').classList.remove('show');
        return;
    }

    // ✅ USAR MISMO ENDPOINT QUE FRONTEND
    const formData = new FormData();
    formData.append('action', 'calculate_price'); // ✅ MISMO ENDPOINT
    formData.append('service_id', adminSelectedServiceId);
    formData.append('adultos', adultos);
    formData.append('residentes', residentes);
    formData.append('ninos_5_12', ninos512);
    formData.append('ninos_menores', ninosMenores);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const result = data.data;
                updateAdminPricingDisplay(result);
            } else {
                console.error('Error calculando precio admin:', data);
                document.getElementById('admin-total-price').textContent = '0€';
                document.getElementById('admin-total-discount').textContent = '';
                document.getElementById('admin-discount-row').style.display = 'none';
                document.getElementById('admin-discount-message').classList.remove('show');
            }
        })
        .catch(error => {
            console.error('Error calculando precio admin:', error);
            document.getElementById('admin-total-price').textContent = '0€';
            document.getElementById('admin-total-discount').textContent = '';
            document.getElementById('admin-discount-row').style.display = 'none';
            document.getElementById('admin-discount-message').classList.remove('show');
        });
}

function updateAdminPricingDisplay(result) {
    // Calcular descuento total
    const descuentoTotal = (result.descuento_grupo || 0) + (result.descuento_servicio || 0);

    // Manejar descuentos
    if (descuentoTotal > 0) {
        document.getElementById('admin-total-discount').textContent = '-' + descuentoTotal.toFixed(2) + '€';
        document.getElementById('admin-discount-row').style.display = 'block';
    } else {
        document.getElementById('admin-discount-row').style.display = 'none';
    }

    // Manejar mensaje de descuento
    let mensajeDescuento = '';

    if (result.regla_descuento_aplicada && result.regla_descuento_aplicada.rule_name && result.descuento_grupo > 0) {
        const regla = result.regla_descuento_aplicada;
        mensajeDescuento = `Descuento del ${regla.discount_percentage}% por ${regla.rule_name.toLowerCase()}`;
    }

    if (result.servicio_con_descuento && result.servicio_con_descuento.descuento_aplicado && result.descuento_servicio > 0) {
        const servicio = result.servicio_con_descuento;
        let mensajeServicio = '';

        if (servicio.descuento_tipo === 'fijo') {
            mensajeServicio = `Descuento del ${servicio.porcentaje_descuento}% aplicado a este servicio`;
        } else if (servicio.descuento_tipo === 'por_grupo') {
            mensajeServicio = `Descuento del ${servicio.porcentaje_descuento}% por alcanzar ${servicio.descuento_minimo_personas} personas`;
        }

        if (mensajeDescuento && mensajeServicio) {
            if (servicio.descuento_acumulable == '1') {
                mensajeDescuento += ` + ${mensajeServicio}`;
            } else {
                const prioridad = servicio.descuento_prioridad || 'servicio';
                if (prioridad === 'servicio') {
                    mensajeDescuento = mensajeServicio;
                }
            }
        } else if (mensajeServicio) {
            mensajeDescuento = mensajeServicio;
        }
    }

    if (mensajeDescuento) {
        document.getElementById('admin-discount-text').textContent = mensajeDescuento;
        document.getElementById('admin-discount-message').classList.add('show');
    } else {
        document.getElementById('admin-discount-message').classList.remove('show');
    }

    window.adminLastDiscountRule = result.regla_descuento_aplicada;

    // Actualizar precio total
    const totalPrice = parseFloat(result.total) || 0;
    document.getElementById('admin-total-price').textContent = totalPrice.toFixed(2) + '€';
}

function clearAdminPricing() {
    document.getElementById('admin-total-discount').textContent = '';
    document.getElementById('admin-total-price').textContent = '0€';
    document.getElementById('admin-discount-row').style.display = 'none';
    document.getElementById('admin-discount-message').classList.remove('show');
}

function validateAdminPersonSelection() {
    const adultos = parseInt(document.getElementById('admin-adultos').value) || 0;
    const residentes = parseInt(document.getElementById('admin-residentes').value) || 0;
    const ninos512 = parseInt(document.getElementById('admin-ninos-5-12').value) || 0;
    const ninosMenores = parseInt(document.getElementById('admin-ninos-menores').value) || 0;

    const totalAdults = adultos + residentes;
    const totalChildren = ninos512 + ninosMenores;

    if (totalChildren > 0 && totalAdults === 0) {
        alert('Debe haber al menos un adulto si hay niños en la reserva.');
        document.getElementById('admin-ninos-5-12').value = 0;
        document.getElementById('admin-ninos-menores').value = 0;
        calculateAdminTotalPrice();
        return false;
    }

    return true;
}



function adminPreviousStep() {
    console.log('Admin: Retrocediendo desde paso', adminCurrentStep);

    if (adminCurrentStep === 2) {
        // Volver al paso 1
        document.getElementById('admin-step-2').style.display = 'none';
        document.getElementById('admin-step-1').style.display = 'block';

        // Actualizar indicadores
        document.getElementById('admin-step-2-indicator').classList.remove('active');
        document.getElementById('admin-step-1-indicator').classList.add('active');

        // Actualizar navegación
        document.getElementById('admin-btn-anterior').style.display = 'none';
        document.getElementById('admin-btn-siguiente').disabled = adminSelectedServiceId ? false : true;
        document.getElementById('admin-step-text').textContent = 'Paso 1 de 4: Seleccionar fecha y horario';

        adminCurrentStep = 1;

    } else if (adminCurrentStep === 3) {
        // Volver al paso 2
        document.getElementById('admin-step-3').style.display = 'none';
        document.getElementById('admin-step-2').style.display = 'block';

        // Actualizar indicadores
        document.getElementById('admin-step-3-indicator').classList.remove('active');
        document.getElementById('admin-step-2-indicator').classList.add('active');

        // Actualizar navegación
        document.getElementById('admin-btn-siguiente').disabled = false;
        document.getElementById('admin-step-text').textContent = 'Paso 2 de 4: Seleccionar personas';

        adminCurrentStep = 2;

    } else if (adminCurrentStep === 4) {
        // Volver al paso 3
        document.getElementById('admin-step-4').style.display = 'none';
        document.getElementById('admin-step-3').style.display = 'block';

        // Actualizar indicadores
        document.getElementById('admin-step-4-indicator').classList.remove('active');
        document.getElementById('admin-step-3-indicator').classList.add('active');

        // Actualizar navegación
        document.getElementById('admin-btn-siguiente').style.display = 'block';
        document.getElementById('admin-btn-confirmar').style.display = 'none';
        document.getElementById('admin-btn-siguiente').disabled = false;
        document.getElementById('admin-step-text').textContent = 'Paso 3 de 4: Datos del cliente';

        adminCurrentStep = 3;
    }
}

function setupAdminFormValidation() {
    const inputs = document.querySelectorAll('#admin-client-form input');

    function validateForm() {
        let allValid = true;
        inputs.forEach(input => {
            if (!input.value.trim()) {
                allValid = false;
            }
        });

        // Validar email específicamente
        const emailInput = document.querySelector('#admin-client-form input[name="email"]');
        if (emailInput.value.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailInput.value.trim())) {
                allValid = false;
            }
        }

        document.getElementById('admin-btn-siguiente').disabled = !allValid;
    }

    inputs.forEach(input => {
        input.addEventListener('input', validateForm);
        input.addEventListener('blur', validateForm);
    });

    // Validar inicialmente
    validateForm();
}

function fillAdminConfirmationData() {
    console.log('=== LLENANDO DATOS DE CONFIRMACIÓN ===');

    // Verificar que tenemos todos los datos necesarios
    if (!adminSelectedServiceId || !adminSelectedDate) {
        console.error('❌ Faltan datos básicos:', {
            serviceId: adminSelectedServiceId,
            selectedDate: adminSelectedDate
        });
        return;
    }

    const service = findAdminServiceById(adminSelectedServiceId);
    if (!service) {
        console.error('❌ No se encontró el servicio');
        return;
    }

    console.log('✅ Servicio encontrado:', service);

    // Obtener datos del formulario
    const nombreInput = document.getElementById('admin-nombre');
    const apellidosInput = document.getElementById('admin-apellidos');
    const emailInput = document.getElementById('admin-email');
    const telefonoInput = document.getElementById('admin-telefono');

    if (!nombreInput || !apellidosInput || !emailInput || !telefonoInput) {
        console.error('❌ No se encontraron los campos del formulario');
        return;
    }

    const nombre = nombreInput.value.trim();
    const apellidos = apellidosInput.value.trim();
    const email = emailInput.value.trim();
    const telefono = telefonoInput.value.trim();

    console.log('✅ Datos del cliente:', { nombre, apellidos, email, telefono });

    // Obtener datos de personas
    const adultos = parseInt(document.getElementById('admin-adultos').value) || 0;
    const residentes = parseInt(document.getElementById('admin-residentes').value) || 0;
    const ninos512 = parseInt(document.getElementById('admin-ninos-5-12').value) || 0;
    const ninosMenores = parseInt(document.getElementById('admin-ninos-menores').value) || 0;
    const totalPersonas = adultos + residentes + ninos512 + ninosMenores;

    console.log('✅ Datos de personas:', { adultos, residentes, ninos512, ninosMenores, totalPersonas });

    // Formatear fecha
    let fechaFormateada = adminSelectedDate;
    try {
        const fechaObj = new Date(adminSelectedDate + 'T00:00:00');
        fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        // Capitalizar primera letra
        fechaFormateada = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
    } catch (e) {
        console.warn('No se pudo formatear la fecha, usando formato original');
    }

    // Crear detalle de personas
    let personasDetalle = [];
    if (adultos > 0) personasDetalle.push(`${adultos} adulto${adultos > 1 ? 's' : ''}`);
    if (residentes > 0) personasDetalle.push(`${residentes} residente${residentes > 1 ? 's' : ''}`);
    if (ninos512 > 0) personasDetalle.push(`${ninos512} niño${ninos512 > 1 ? 's' : ''} (5-12)`);
    if (ninosMenores > 0) personasDetalle.push(`${ninosMenores} bebé${ninosMenores > 1 ? 's' : ''} (gratis)`);

    const personasTexto = personasDetalle.length > 0 ?
        `${totalPersonas} personas (${personasDetalle.join(', ')})` :
        `${totalPersonas} personas`;

    // Obtener precio total
    const totalPriceElement = document.getElementById('admin-total-price');
    const precioTotal = totalPriceElement ? totalPriceElement.textContent : '0€';

    console.log('✅ Datos finales a mostrar:', {
        fecha: fechaFormateada,
        hora: service.hora,
        personas: personasTexto,
        cliente: `${nombre} ${apellidos}`,
        email: email,
        total: precioTotal
    });

    // Actualizar elementos de confirmación
    const confirmElements = {
        'admin-confirm-fecha': fechaFormateada,
        'admin-confirm-hora': service.hora,
        'admin-confirm-personas': personasTexto,
        'admin-confirm-cliente': `${nombre} ${apellidos}`,
        'admin-confirm-email': email,
        'admin-confirm-total': precioTotal
    };

    // Aplicar datos a los elementos
    let errorsFound = 0;
    Object.keys(confirmElements).forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = confirmElements[elementId];
            console.log(`✅ ${elementId}: ${confirmElements[elementId]}`);
        } else {
            console.error(`❌ No se encontró elemento: ${elementId}`);
            errorsFound++;
        }
    });

    if (errorsFound === 0) {
        console.log('✅ Todos los datos de confirmación se llenaron correctamente');
    } else {
        console.error(`❌ Se encontraron ${errorsFound} errores al llenar los datos`);
    }
}

function adminConfirmReservation() {
    console.log('=== CONFIRMANDO RESERVA RÁPIDA ADMIN ===');

    if (!confirm('¿Estás seguro de que quieres procesar esta reserva?\n\nSe enviará automáticamente la confirmación por email al cliente.')) {
        return;
    }

    // Deshabilitar botón
    const confirmBtn = document.getElementById('admin-btn-confirmar');
    const originalText = confirmBtn.textContent;
    confirmBtn.disabled = true;
    confirmBtn.textContent = '⏳ Procesando...';

    // Preparar datos de la reserva
    const service = findAdminServiceById(adminSelectedServiceId);
    const form = document.getElementById('admin-client-form');
    const formData = new FormData(form);

    const adultos = parseInt(document.getElementById('admin-adultos').value) || 0;
    const residentes = parseInt(document.getElementById('admin-residentes').value) || 0;
    const ninos_5_12 = parseInt(document.getElementById('admin-ninos-5-12').value) || 0;
    const ninos_menores = parseInt(document.getElementById('admin-ninos-menores').value) || 0;

    const totalPrice = document.getElementById('admin-total-price').textContent.replace('€', '').trim();
    const descuentoTotal = document.getElementById('admin-total-discount').textContent.replace('€', '').replace('-', '').trim();

    const reservationData = {
        fecha: adminSelectedDate,
        service_id: adminSelectedServiceId,
        hora_ida: service.hora,
        adultos: adultos,
        residentes: residentes,
        ninos_5_12: ninos_5_12,
        ninos_menores: ninos_menores,
        precio_adulto: service.precio_adulto,
        precio_nino: service.precio_nino,
        precio_residente: service.precio_residente,
        total_price: totalPrice,
        descuento_grupo: descuentoTotal ? parseFloat(descuentoTotal) : 0,
        regla_descuento_aplicada: window.adminLastDiscountRule || null
    };

    // Enviar solicitud AJAX
    const ajaxData = {
        action: 'process_reservation',
        nonce: reservasAjax.nonce,
        nombre: formData.get('nombre'),
        apellidos: formData.get('apellidos'),
        email: formData.get('email'),
        telefono: formData.get('telefono'),
        reservation_data: JSON.stringify(reservationData)
    };

    console.log('Datos a enviar:', ajaxData);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(ajaxData)
    })
        .then(response => response.json())
        .then(data => {
            console.log('Respuesta recibida:', data);

            // Rehabilitar botón
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalText;

            if (data && data.success) {
                console.log('Reserva procesada exitosamente:', data.data);

                // Mostrar mensaje de éxito
                const detalles = data.data.detalles;
                const mensaje = "🎉 ¡RESERVA CREADA EXITOSAMENTE! 🎉\n\n" +
                    "📋 LOCALIZADOR: " + data.data.localizador + "\n\n" +
                    "📅 DETALLES:\n" +
                    "• Fecha: " + detalles.fecha + "\n" +
                    "• Hora: " + detalles.hora + "\n" +
                    "• Personas: " + detalles.personas + "\n" +
                    "• Precio: " + detalles.precio_final + "€\n\n" +
                    "✅ La reserva ha sido procesada correctamente.\n" +
                    "📧 El cliente recibirá la confirmación por email.\n\n" +
                    "¡Reserva administrativa completada!";

                alert(mensaje);

                // Volver al dashboard
                setTimeout(() => {
                    goBackToDashboard();
                }, 2000);

            } else {
                console.error('Error procesando reserva:', data);
                const errorMsg = data && data.data ? data.data : 'Error desconocido';
                alert('❌ Error procesando la reserva: ' + errorMsg);
            }
        })
        .catch(error => {
            console.error('Error de conexión:', error);

            // Rehabilitar botón
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalText;

            alert('❌ Error de conexión al procesar la reserva.\n\nPor favor, inténtalo de nuevo. Si el problema persiste, contacta con soporte técnico.');
        });
}

// Exponer funciones globalmente para onclick
window.selectAdminDate = selectAdminDate;
window.adminNextStep = adminNextStep;
window.adminPreviousStep = adminPreviousStep;
window.adminConfirmReservation = adminConfirmReservation;

function adminNextStep() {
    console.log('Admin: Avanzando al siguiente paso desde', adminCurrentStep);

    if (adminCurrentStep === 1) {
        // Validar paso 1
        if (!adminSelectedDate || !adminSelectedServiceId) {
            alert('Por favor, selecciona una fecha y horario.');
            return;
        }

        // Ocultar paso 1 y mostrar paso 2
        document.getElementById('admin-step-1').style.display = 'none';
        document.getElementById('admin-step-2').style.display = 'block';

        // Actualizar indicadores de pasos
        document.getElementById('admin-step-1-indicator').classList.remove('active');
        document.getElementById('admin-step-2-indicator').classList.add('active');

        // Actualizar navegación
        document.getElementById('admin-btn-anterior').style.display = 'block';
        document.getElementById('admin-btn-siguiente').disabled = true;
        document.getElementById('admin-step-text').textContent = 'Paso 2 de 4: Seleccionar personas';

        adminCurrentStep = 2;

        // Cargar precios en el paso 2
        loadAdminPrices();

    } else if (adminCurrentStep === 2) {
        // Validar paso 2
        const adultos = parseInt(document.getElementById('admin-adultos').value) || 0;
        const residentes = parseInt(document.getElementById('admin-residentes').value) || 0;
        const ninos512 = parseInt(document.getElementById('admin-ninos-5-12').value) || 0;
        const ninosMenores = parseInt(document.getElementById('admin-ninos-menores').value) || 0;

        const totalPersonas = adultos + residentes + ninos512 + ninosMenores;

        if (totalPersonas === 0) {
            alert('Debe seleccionar al menos una persona.');
            return;
        }

        if (!validateAdminPersonSelection()) {
            return;
        }

        // Ocultar paso 2 y mostrar paso 3
        document.getElementById('admin-step-2').style.display = 'none';
        document.getElementById('admin-step-3').style.display = 'block';

        // Actualizar indicadores de pasos
        document.getElementById('admin-step-2-indicator').classList.remove('active');
        document.getElementById('admin-step-3-indicator').classList.add('active');

        // Actualizar navegación
        document.getElementById('admin-btn-siguiente').disabled = true;
        document.getElementById('admin-step-text').textContent = 'Paso 3 de 4: Datos del cliente';

        adminCurrentStep = 3;

        // Configurar validación del formulario
        setupAdminFormValidation();

    } else if (adminCurrentStep === 3) {
        // Validar paso 3
        const form = document.getElementById('admin-client-form');

        // Verificar que el formulario existe
        if (!form) {
            console.error('❌ No se encontró el formulario de cliente');
            alert('Error: No se encontró el formulario. Recarga la página e inténtalo de nuevo.');
            return;
        }

        const formData = new FormData(form);

        const nombre = formData.get('nombre') ? formData.get('nombre').trim() : '';
        const apellidos = formData.get('apellidos') ? formData.get('apellidos').trim() : '';
        const email = formData.get('email') ? formData.get('email').trim() : '';
        const telefono = formData.get('telefono') ? formData.get('telefono').trim() : '';

        console.log('=== VALIDANDO PASO 3 ===');
        console.log('Datos del formulario:', { nombre, apellidos, email, telefono });

        if (!nombre || !apellidos || !email || !telefono) {
            console.error('❌ Campos faltantes:', { nombre, apellidos, email, telefono });
            alert('Por favor, completa todos los campos del cliente.');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.error('❌ Email no válido:', email);
            alert('Por favor, introduce un email válido.');
            return;
        }

        console.log('✅ Validación del paso 3 completada');

        // Ocultar paso 3 y mostrar paso 4
        document.getElementById('admin-step-3').style.display = 'none';
        document.getElementById('admin-step-4').style.display = 'block';

        // Actualizar indicadores de pasos
        document.getElementById('admin-step-3-indicator').classList.remove('active');
        document.getElementById('admin-step-4-indicator').classList.add('active');

        // Actualizar navegación
        document.getElementById('admin-btn-siguiente').style.display = 'none';
        document.getElementById('admin-btn-confirmar').style.display = 'block';
        document.getElementById('admin-step-text').textContent = 'Paso 4 de 4: Confirmar reserva';

        adminCurrentStep = 4;

        // ✅ AÑADIR UN PEQUEÑO DELAY PARA ASEGURAR QUE EL DOM SE ACTUALICE
        setTimeout(() => {
            fillAdminConfirmationData();
        }, 100);
    }
}


function loadAgenciesSection() {
    console.log('=== CARGANDO SECCIÓN DE AGENCIAS ===');

    // Mostrar indicador de carga
    showLoadingInMainContent();

    // Cargar la lista de agencias
    jQuery.ajax({
        url: reservasAjax.ajax_url,
        type: 'POST',
        data: {
            action: 'get_agencies_list',
            nonce: reservasAjax.nonce
        },
        success: function (response) {
            console.log('Respuesta del servidor:', response);

            if (response.success) {
                renderAgenciesSection(response.data);
            } else {
                showErrorInMainContent('Error cargando agencias: ' + response.data);
            }
        },
        error: function (xhr, status, error) {
            console.error('Error AJAX:', error);
            showErrorInMainContent('Error de conexión al cargar agencias');
        }
    });
}

function showErrorInMainContent(message) {
    document.body.innerHTML = `
        <div class="error-container" style="text-align: center; padding: 50px;">
            <h2 style="color: #d63638;">Error</h2>
            <p style="color: #d63638;">${message}</p>
            <button class="btn-secondary" onclick="goBackToDashboard()">← Volver al Dashboard</button>
        </div>
    `;
}

/**
 * Renderizar la sección de gestión de agencias
 */
function renderAgenciesSection(agencies) {
    const content = `
        <div class="agencies-management">
            <div class="section-header">
                <h2>🏢 Gestión de Agencias</h2>
                <p>Administra las agencias asociadas al sistema de reservas</p>
            </div>
            
            <div class="actions-bar">
                <button class="btn-primary" onclick="showCreateAgencyModal()">
                    ➕ Crear Nueva Agencia
                </button>
                <button class="btn-secondary" onclick="refreshAgenciesList()">
                    🔄 Actualizar Lista
                </button>
                <button class="btn-secondary" onclick="goBackToDashboard()">
                    ← Volver al Dashboard
                </button>
            </div>
            
            <div class="agencies-stats">
    <div class="stat-card">
        <h3>Total Agencias</h3>
        <div class="stat-number">${agencies.length}</div>
    </div>
    <div class="stat-card">
        <h3>Agencias Activas</h3>
        <div class="stat-number">${agencies.filter(a => a.status === 'active').length}</div>
    </div>
    <div class="stat-card">
        <h3>Agencias Inactivas</h3>
        <div class="stat-number">${agencies.filter(a => a.status !== 'active').length}</div>
    </div>
    <div class="stat-card">
        <h3>Con Datos Fiscales</h3>
        <div class="stat-number">${agencies.filter(a => a.cif && a.cif.length > 0).length}</div>
    </div>
</div>
            
            <div class="agencies-table-container">
                <table class="agencies-table">
    <thead>
        <tr>
            <th style="display:none">ID</th>
            <th>Nombre Agencia</th>
            <th>Contacto</th>
            <th>Email</th>
            <th>Usuario</th>
            <th>CIF</th>
            <th>Inicial Loc.</th>  <!-- ✅ NUEVA COLUMNA -->
            <th>Estado</th>
            <th>Fecha Creación</th>
            <th>Acciones</th>
        </tr>
    </thead>
    <tbody>
        ${renderAgenciesTableRowsContent(agencies)}
    </tbody>
</table>
            </div>
        </div>
        
        ${renderCreateAgencyModal()}
        ${renderEditAgencyModal()}
        
        <style>
        .agencies-management {
            padding: 20px;
        }
        
        .section-header h2 {
            margin: 0 0 10px 0;
            color: #23282d;
        }
        
        .section-header p {
            margin: 0 0 30px 0;
            color: #666;
        }
        
        .actions-bar {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
            align-items: center;
        }
        
        .agencies-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-left: 4px solid #0073aa;
            text-align: center;
        }
        
        .stat-card h3 {
            margin: 0 0 10px 0;
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
        }
        
        .stat-card .stat-number {
            font-size: 32px;
            font-weight: bold;
            color: #0073aa;
        }
        
        .agencies-table-container {
            background: white;
            border-radius: 8px;
            overflow-x: auto;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .agencies-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .agencies-table th,
        .agencies-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        
        .agencies-table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #23282d;
        }
        
        .agencies-table tr:hover {
            background: #f8f9fa;
        }
        
        .status-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .status-active {
            background: #edfaed;
            color: #00a32a !important;
        }
        
        .status-inactive {
            background: #fef7f7;
            color: #d63638;
        }
        
        .status-suspended {
            background: #fff8e1;
            color: #f57c00;
        }
        
        .actions-cell {
            white-space: nowrap;
        }
        
        .btn-edit, .btn-toggle, .btn-delete {
            padding: 6px 12px;
            margin: 0 2px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            text-decoration: none;
            display: inline-block;
        }
        
        .btn-edit {
            background: #0073aa;
            color: white;
        }
        
        .btn-toggle {
            background: #f57c00;
            color: white;
        }
        
        .btn-delete {
            background: #d63638;
            color: white;
        }
        
        .btn-edit:hover {
            background: #005a87;
        }
        
        .btn-toggle:hover {
            background: #e65100;
        }
        
        .btn-delete:hover {
            background: #b32d36;
        }
        </style>
    `;

    // Insertar contenido en el dashboard principal
    jQuery('.dashboard-content').html(content);
}


function renderAgenciesTableRowsContent(agencies) {
    if (agencies.length === 0) {
        return `
        <tr>
            <td colspan="10" style="text-align: center; padding: 40px; color: #666;">
                No hay agencias registradas. Crea la primera agencia usando el botón "Crear Nueva Agencia".
            </td>
        </tr>
    `;
    }

    return agencies.map(agency => `
    <tr>
        <td style="display:none">${agency.id}</td>
        <td><strong>${escapeHtml(agency.agency_name)}</strong></td>
        <td>${escapeHtml(agency.contact_person)}</td>
        <td><a href="mailto:${agency.email}">${escapeHtml(agency.email)}</a></td>
        <td><code>${escapeHtml(agency.username)}</code></td>
        <td>${escapeHtml(agency.cif || '-')}</td>
        <td><code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-weight: bold; color: #0073aa;">${escapeHtml(agency.inicial_localizador || 'A')}</code></td>  <!-- ✅ NUEVA COLUMNA -->
        <td>
            <span class="status-badge status-${agency.status}">
                ${getStatusText(agency.status)}
            </span>
        </td>
        <td>${formatDate(agency.created_at)}</td>
        <td class="actions-cell">
            <button class="btn-edit" onclick="editAgency(${agency.id})" title="Editar">
                ✏️
            </button>
            <button class="btn-toggle" onclick="toggleAgencyStatus(${agency.id}, '${agency.status}')" title="Cambiar Estado">
                ${agency.status === 'active' ? '⏸️' : '▶️'}
            </button>
            <button class="btn-delete" onclick="deleteAgency(${agency.id})" title="Eliminar">
                🗑️
            </button>
        </td>
    </tr>
`).join('');
}

/**
 * Renderizar filas de la tabla de agencias
 */
function renderAgenciesTableRows(agencies) {
    if (agencies.length === 0) {
        return `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: #666;">
                    No hay agencias registradas. Crea la primera agencia usando el botón "Crear Nueva Agencia".
                </td>
            </tr>
        `;
    }

    return agencies.map(agency => `
        <tr>
            <td>${agency.id}</td>
            <td><strong>${escapeHtml(agency.agency_name)}</strong></td>
            <td>${escapeHtml(agency.contact_person)}</td>
            <td><a href="mailto:${agency.email}">${escapeHtml(agency.email)}</a></td>
            <td><code>${escapeHtml(agency.username)}</code></td>
            <td>${parseFloat(agency.commission_percentage).toFixed(1)}%</td>
            <td>
                <span class="status-badge status-${agency.status}">
                    ${getStatusText(agency.status)}
                </span>
            </td>
            <td>${formatDate(agency.created_at)}</td>
            <td class="actions-cell">
                <button class="btn-edit" onclick="editAgency(${agency.id})" title="Editar">
                    ✏️
                </button>
                <button class="btn-toggle" onclick="toggleAgencyStatus(${agency.id}, '${agency.status}')" title="Cambiar Estado">
                    ${agency.status === 'active' ? '⏸️' : '▶️'}
                </button>
                <button class="btn-delete" onclick="deleteAgency(${agency.id})" title="Eliminar">
                    🗑️
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Renderizar modal de crear agencia
 */
function renderCreateAgencyModal() {
    return `
        <div id="createAgencyModal" class="modal" style="display: none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Crear Nueva Agencia</h3>
                    <span class="close" onclick="closeCreateAgencyModal()">&times;</span>
                </div>
                <form id="createAgencyForm">
                    
                    <!-- ✅ ESTADO AL PRINCIPIO CON DISEÑO LLAMATIVO -->
                    <div class="form-section status-section">
                        <div class="form-group status-group">
                            <select name="status" id="status" class="status-select">
                                <option value="active">✅ Activa</option>
                                <option value="inactive">⏸️ Inactiva</option>
                            </select>
                        </div>
                    </div>

                    <!-- Información Básica -->
                    <div class="form-section">
                        <h4>👤 Información Básica</h4>
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="agency_name">Nombre de la Agencia *</label>
                                <input type="text" name="agency_name" required placeholder="Ej: Viajes El Sol">
                            </div>
                            <div class="form-group">
                                <label for="contact_person">Persona de Contacto *</label>
                                <input type="text" name="contact_person" required placeholder="Ej: Juan Pérez">
                            </div>
                            <div class="form-group">
                                <label for="email">Email *</label>
                                <input type="email" name="email" required placeholder="contacto@agencia.com">
                            </div>
                            <div class="form-group">
                                <label for="phone">Teléfono</label>
                                <input type="tel" name="phone" placeholder="957 123 456">
                            </div>
                            <div class="form-group">
                                <label for="username">Usuario de Acceso *</label>
                                <input type="text" name="username" required placeholder="agencia_sol">
                            </div>
                            <div class="form-group">
                                <label for="password">Contraseña *</label>
                                <input type="password" name="password" required placeholder="Mínimo 6 caracteres">
                            </div>
                        </div>
                    </div>
                    
                    <!-- ✅ INFORMACIÓN FISCAL MEJORADA -->
<div class="form-section">
    <h4>🏛️ Información Fiscal</h4>
    <div class="form-grid">
        <div class="form-group">
            <label for="razon_social">Razón Social</label>
            <input type="text" name="razon_social" placeholder="Denominación social oficial">
        </div>
        <div class="form-group">
            <label for="cif">CIF/NIF</label>
            <input type="text" name="cif" placeholder="B12345678">
        </div>
        <div class="form-group form-group-full">
            <label for="domicilio_fiscal">Domicilio Fiscal</label>
            <input type="text" name="domicilio_fiscal" placeholder="Dirección fiscal completa">
        </div>
        <!-- ✅ AÑADIR ESTE CAMPO: -->
        <div class="form-group">
            <label for="inicial_localizador">Inicial Localizador *</label>
            <input type="text" name="inicial_localizador" id="inicial_localizador" 
                   value="A" maxlength="5" required placeholder="Ej: A, B, MAD"
                   style="text-transform: uppercase;">
            <small>Letra(s) que aparecerán al inicio de los localizadores (máx. 5 caracteres)</small>
        </div>
        <div class="form-group">
    <label for="horas_cancelacion_previa">Horas Previas a Cancelación</label>
    <input type="number" name="horas_cancelacion_previa" id="horas_cancelacion_previa" 
           value="24" min="1" max="168" required
           style="background-color: #fff3cd; border: 2px solid #ffc107;">
    <small style="color: #856404; font-weight: bold;">⏰ Tiempo límite (en horas) para que esta agencia pueda cancelar reservas</small>
</div>
    </div>
</div>
                    
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Crear Agencia</button>
                        <button type="button" class="btn-secondary" onclick="closeCreateAgencyModal()">Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}


/**
 * Renderizar modal de editar agencia
 */
function renderEditAgencyModal() {
    return `
        <div id="editAgencyModal" class="modal" style="display: none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Editar Agencia</h3>
                    <span class="close" onclick="closeEditAgencyModal()">&times;</span>
                </div>
                <form id="editAgencyForm">
                    <input type="hidden" name="agency_id" id="edit_agency_id">
                    
                    <!-- ✅ ESTADO MOVIDO AL PRINCIPIO CON DISEÑO LLAMATIVO -->
                    <div class="form-section status-section">
                        <div class="form-group status-group">
                            
                            <select name="status" id="edit_status" class="status-select">
                                <option value="active">✅ Activa</option>
                                <option value="inactive">⏸️ Inactiva</option>
                            </select>
                        </div>
                    </div>

                    <!-- Información Básica -->
                    <div class="form-section">
                        <h4>👤 Información Básica</h4>
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="edit_agency_name">Nombre de la Agencia *</label>
                                <input type="text" name="agency_name" id="edit_agency_name" required>
                            </div>
                            <div class="form-group">
                                <label for="edit_contact_person">Persona de Contacto *</label>
                                <input type="text" name="contact_person" id="edit_contact_person" required>
                            </div>
                            <div class="form-group">
                                <label for="edit_email">Email *</label>
                                <input type="email" name="email" id="edit_email" required>
                            </div>
                            <div class="form-group">
                                <label for="edit_phone">Teléfono</label>
                                <input type="tel" name="phone" id="edit_phone">
                            </div>
                            <div class="form-group">
                                <label for="edit_username">Usuario de Acceso *</label>
                                <input type="text" name="username" id="edit_username" required>
                            </div>
                            <div class="form-group">
                                <label for="edit_password">Nueva Contraseña</label>
                                <input type="password" name="password" id="edit_password" placeholder="Dejar vacío para no cambiar">
                            </div>
                        </div>
                    </div>

                    <!-- ✅ INFORMACIÓN FISCAL MEJORADA -->
<div class="form-section">
    <h4>🏛️ Información Fiscal</h4>
    <div class="form-grid">
        <div class="form-group">
            <label for="edit_razon_social">Razón Social</label>
            <input type="text" name="razon_social" id="edit_razon_social" placeholder="Denominación social oficial">
        </div>
        <div class="form-group">
            <label for="edit_cif">CIF/NIF</label>
            <input type="text" name="cif" id="edit_cif" placeholder="B12345678">
        </div>
        <div class="form-group form-group-full">
            <label for="edit_domicilio_fiscal">Domicilio Fiscal</label>
            <input type="text" name="domicilio_fiscal" id="edit_domicilio_fiscal" placeholder="Dirección fiscal completa">
        </div>
        <!-- ✅ AÑADIR ESTE CAMPO: -->
        <div class="form-group">
            <label for="edit_inicial_localizador">Inicial Localizador *</label>
            <input type="text" name="inicial_localizador" id="edit_inicial_localizador" 
                   maxlength="5" required placeholder="Ej: A, B, MAD"
                   style="text-transform: uppercase;">
            <small>Letra(s) que aparecerán al inicio de los localizadores (máx. 5 caracteres)</small>
        </div>
        <div class="form-group">
    <label for="edit_horas_cancelacion_previa">Horas Previas a Cancelación</label>
    <input type="number" name="horas_cancelacion_previa" id="edit_horas_cancelacion_previa" 
           min="1" max="168" required
           style="background-color: #fff3cd; border: 2px solid #ffc107;">
    <small style="color: #856404; font-weight: bold;">⏰ Tiempo límite (en horas) para que esta agencia pueda cancelar reservas</small>
</div>
    </div>
</div>
                    
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Actualizar Agencia</button>
                        <button type="button" class="btn-secondary" onclick="closeEditAgencyModal()">Cancelar</button>
                    </div>
                </form>
            </div>
            
            <style>
                .form-section {
                    margin-bottom: 25px;
                    padding: 20px;
                    border: 1px solid #e1e1e1;
                    border-radius: 8px;
                    background: #fafafa;
                }
                
                /* ✅ ESTILOS ESPECIALES PARA LA SECCIÓN DE ESTADO */
                .status-section {
                    border: 1px solid #e1e1e1;
    border-radius: 8px;
    background: #fafafa;
                    color: white;
                    text-align: center;
                    margin-bottom: 30px;
                }
                
                .status-group {
                    margin: 0;
                }
                
                .status-group label {
                    color: white;
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 15px;
                    display: block;
                }
                
                .status-select {
                    width: 100%;
                    max-width: 300px;
                    padding: 12px 15px;
                    font-size: 16px;
                    font-weight: 600;
                    border: 3px solid white;
                    border-radius: 8px;
                    background: white;
                    color: #333;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                
                .status-select:focus {
                    outline: none;
                    border-color: #ffd700;
                    box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
                    transform: translateY(-2px);
                }
                
                .status-select option {
                    padding: 10px;
                    font-weight: 600;
                }
                
                .form-section h4 {
                    margin: 0 0 15px 0;
                    color: #333;
                    font-size: 16px;
                    font-weight: 600;
                    border-bottom: 2px solid #0073aa;
                    padding-bottom: 8px;
                }
                
                .form-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                }
                
                /* ✅ CLASE PARA ELEMENTOS QUE OCUPAN TODO EL ANCHO */
                .form-group-full {
                    grid-column: 1 / -1;
                }
                
                .form-group {
                    display: flex;
                    flex-direction: column;
                }
                
                .form-group label {
                    font-weight: 600;
                    margin-bottom: 5px;
                    color: #333;
                }
                
                .form-group input, .form-group textarea {
                    padding: 10px;
                    border: 2px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                    transition: border-color 0.3s;
                }
                
                .form-group input:focus, .form-group textarea:focus {
                    outline: none;
                    border-color: #0073aa;
                    box-shadow: 0 0 5px rgba(0, 115, 170, 0.3);
                }
                
                @media (max-width: 768px) {
                    .form-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .status-select {
                        max-width: 100%;
                    }
                }
            </style>
        </div>
    `;
}

function showCreateAgencyModal() {
    jQuery('#createAgencyModal').show();
    jQuery('#createAgencyForm')[0].reset();
}

/**
 * Cerrar modal de crear agencia
 */
function closeCreateAgencyModal() {
    jQuery('#createAgencyModal').hide();
}

/**
 * Cerrar modal de editar agencia
 */
function closeEditAgencyModal() {
    jQuery('#editAgencyModal').hide();
}

/**
 * Editar agencia
 */
function editAgency(agencyId) {
    console.log('Editando agencia ID:', agencyId);

    jQuery.ajax({
        url: reservasAjax.ajax_url,
        type: 'POST',
        data: {
            action: 'get_agency_details',
            agency_id: agencyId,
            nonce: reservasAjax.nonce
        },
        success: function (response) {
            if (response.success) {
                const agency = response.data;

                // Rellenar campos básicos
                jQuery('#edit_agency_id').val(agency.id);
                jQuery('#edit_agency_name').val(agency.agency_name);
                jQuery('#edit_contact_person').val(agency.contact_person);
                jQuery('#edit_email').val(agency.email);
                jQuery('#edit_phone').val(agency.phone || '');
                jQuery('#edit_username').val(agency.username);
                jQuery('#edit_password').val('');

                // ✅ CAMPOS FISCALES
                jQuery('#edit_razon_social').val(agency.razon_social || '');
                jQuery('#edit_cif').val(agency.cif || '');
                jQuery('#edit_domicilio_fiscal').val(agency.domicilio_fiscal || '');

                // ✅ AÑADIR ESTA LÍNEA:
                jQuery('#edit_inicial_localizador').val(agency.inicial_localizador || 'A');
                jQuery('#edit_horas_cancelacion_previa').val(agency.horas_cancelacion_previa || 24);

                // ✅ ESTADO
                jQuery('#edit_status').val(agency.status);

                // Mostrar modal
                jQuery('#editAgencyModal').show();
            } else {
                alert('Error cargando datos de la agencia: ' + response.data);
            }
        },
        error: function () {
            alert('Error de conexión al cargar datos de la agencia');
        }
    });
}

/**
 * Cambiar estado de agencia
 */
function toggleAgencyStatus(agencyId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const statusText = newStatus === 'active' ? 'activar' : 'desactivar';

    if (confirm(`¿Estás seguro de que quieres ${statusText} esta agencia?`)) {
        jQuery.ajax({
            url: reservasAjax.ajax_url,
            type: 'POST',
            data: {
                action: 'toggle_agency_status',
                agency_id: agencyId,
                new_status: newStatus,
                nonce: reservasAjax.nonce
            },
            success: function (response) {
                if (response.success) {
                    alert(response.data);
                    loadAgenciesSection(); // Recargar lista
                } else {
                    alert('Error: ' + response.data);
                }
            },
            error: function () {
                alert('Error de conexión al cambiar estado');
            }
        });
    }
}

/**
 * Eliminar agencia
 */
function deleteAgency(agencyId) {
    if (confirm('¿Estás seguro de que quieres eliminar esta agencia? Esta acción no se puede deshacer.')) {
        jQuery.ajax({
            url: reservasAjax.ajax_url,
            type: 'POST',
            data: {
                action: 'delete_agency',
                agency_id: agencyId,
                nonce: reservasAjax.nonce
            },
            success: function (response) {
                if (response.success) {
                    alert(response.data);
                    loadAgenciesSection(); // Recargar lista
                } else {
                    alert('Error: ' + response.data);
                }
            },
            error: function () {
                alert('Error de conexión al eliminar agencia');
            }
        });
    }
}

/**
 * Actualizar lista de agencias
 */
function refreshAgenciesList() {
    loadAgenciesSection();
}

/**
 * Manejar envío del formulario de crear agencia
 */
jQuery(document).on('submit', '#createAgencyForm', function (e) {
    e.preventDefault();

    const formData = jQuery(this).serialize();

    jQuery.ajax({
        url: reservasAjax.ajax_url,
        type: 'POST',
        data: {
            action: 'save_agency',
            ...Object.fromEntries(new URLSearchParams(formData)),
            nonce: reservasAjax.nonce
        },
        success: function (response) {
            if (response.success) {
                alert(response.data);
                closeCreateAgencyModal();
                loadAgenciesSection(); // Recargar lista
            } else {
                alert('Error: ' + response.data);
            }
        },
        error: function () {
            alert('Error de conexión al crear agencia');
        }
    });
});

/**
 * Manejar envío del formulario de editar agencia
 */
jQuery(document).on('submit', '#editAgencyForm', function (e) {
    e.preventDefault();

    const formData = jQuery(this).serialize();

    jQuery.ajax({
        url: reservasAjax.ajax_url,
        type: 'POST',
        data: {
            action: 'save_agency',
            ...Object.fromEntries(new URLSearchParams(formData)),
            nonce: reservasAjax.nonce
        },
        success: function (response) {
            if (response.success) {
                alert(response.data);
                closeEditAgencyModal();
                loadAgenciesSection(); // Recargar lista
            } else {
                alert('Error: ' + response.data);
            }
        },
        error: function () {
            alert('Error de conexión al actualizar agencia');
        }
    });
});

// Funciones auxiliares
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStatusText(status) {
    const statusMap = {
        'active': 'Activa',
        'inactive': 'Inactiva',
        'suspended': 'Suspendida'
    };
    return statusMap[status] || status;
}

function formatDate(dateString) {
    if (!dateString) return '-';

    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
}

function showLoadingInMainContent() {
    jQuery('.dashboard-content').html('<div class="loading">Cargando gestión de agencias...</div>');
}

function showErrorInMainContent(message) {
    jQuery('.dashboard-content').html(`<div class="error">${message}</div>`);
}







function initAdminReservaRapida() {
    console.log('=== INICIALIZANDO RESERVA RÁPIDA ADMIN (NUEVO FLUJO) ===');

    // Mostrar interfaz de reserva rápida
    document.body.innerHTML = `
        <div class="admin-reserva-rapida">
            <div class="admin-header">
                <h1>⚡ Reserva Rápida - Administrador</h1>
                <div class="admin-actions">
                    <button class="btn-secondary" onclick="goBackToDashboard()">← Volver al Dashboard</button>
                </div>
            </div>
            
            <div class="admin-steps-container">
                <div class="admin-step-indicator">
                    <div class="admin-step active" id="admin-step-1-indicator">
                        <div class="admin-step-number">1</div>
                        <div class="admin-step-title">Fecha y Hora</div>
                    </div>
                    <div class="admin-step" id="admin-step-2-indicator">
                        <div class="admin-step-number">2</div>
                        <div class="admin-step-title">Personas</div>
                    </div>
                    <div class="admin-step" id="admin-step-3-indicator">
                        <div class="admin-step-number">3</div>
                        <div class="admin-step-title">Datos Cliente</div>
                    </div>
                    <div class="admin-step" id="admin-step-4-indicator">
                        <div class="admin-step-number">4</div>
                        <div class="admin-step-title">Confirmar</div>
                    </div>
                </div>
                
                <!-- Paso 1: Seleccionar fecha y horario -->
                <div class="admin-step-content" id="admin-step-1">
                    <h2>1. Selecciona fecha y horario</h2>
                    
                    <div class="admin-calendar-section">
                        <div class="admin-calendar-controls">
                            <button id="admin-prev-month">← Mes Anterior</button>
                            <h3 id="admin-current-month-year"></h3>
                            <button id="admin-next-month">Siguiente Mes →</button>
                        </div>
                        
                        <div class="admin-calendar-container">
                            <div id="admin-calendar-grid">
                                <!-- Calendario se cargará aquí -->
                            </div>
                        </div>
                    </div>
                    
                    <div class="admin-schedule-section">
                        <label for="admin-horarios-select">Horarios disponibles:</label>
                        <select id="admin-horarios-select" disabled>
                            <option value="">Selecciona primero una fecha</option>
                        </select>
                    </div>
                </div>
                
                <!-- Paso 2: Seleccionar personas -->
                <div class="admin-step-content" id="admin-step-2" style="display: none;">
                    <h2>2. Selecciona el número de personas</h2>
                    
                    <div class="admin-persons-grid">
                        <div class="admin-person-selector">
                            <label for="admin-adultos">Adultos:</label>
                            <input type="number" id="admin-adultos" min="0" max="50" value="0">
                            <span id="admin-price-adultos" class="admin-price">10€</span>
                        </div>
                        
                        <div class="admin-person-selector">
                            <label for="admin-residentes">Residentes:</label>
                            <input type="number" id="admin-residentes" min="0" max="50" value="0">
                            <span class="admin-price">5€</span>
                        </div>
                        
                        <div class="admin-person-selector">
                            <label for="admin-ninos-5-12">Niños (5-12 años):</label>
                            <input type="number" id="admin-ninos-5-12" min="0" max="50" value="0">
                            <span id="admin-price-ninos" class="admin-price">5€</span>
                        </div>
                        
                        <div class="admin-person-selector">
                            <label for="admin-ninos-menores">Niños (-5 años):</label>
                            <input type="number" id="admin-ninos-menores" min="0" max="50" value="0">
                            <span class="admin-price">GRATIS</span>
                        </div>
                    </div>
                    
                    <div class="admin-pricing-summary">
                        <div class="admin-discount-row" id="admin-discount-row" style="display: none;">
                            <span>Descuento:</span>
                            <span id="admin-total-discount">-0€</span>
                        </div>
                        <div class="admin-total-row">
                            <span>Total:</span>
                            <span id="admin-total-price">0€</span>
                        </div>
                    </div>
                    
                    <div class="admin-discount-message" id="admin-discount-message">
                        <span id="admin-discount-text"></span>
                    </div>
                </div>
                
                <!-- Paso 3: Datos del cliente -->
                <div class="admin-step-content" id="admin-step-3" style="display: none;">
                    <h2>3. Datos del cliente</h2>
                    
                    <form id="admin-client-form" class="admin-client-form">
                        <div class="admin-form-row">
                            <div class="admin-form-group">
                                <label for="admin-nombre">Nombre *</label>
                                <input type="text" id="admin-nombre" name="nombre" required>
                            </div>
                            <div class="admin-form-group">
                                <label for="admin-apellidos">Apellidos *</label>
                                <input type="text" id="admin-apellidos" name="apellidos" required>
                            </div>
                        </div>
                        
                        <div class="admin-form-row">
                            <div class="admin-form-group">
                                <label for="admin-email">Email *</label>
                                <input type="email" id="admin-email" name="email" required>
                            </div>
                            <div class="admin-form-group">
                                <label for="admin-telefono">Teléfono *</label>
                                <input type="tel" id="admin-telefono" name="telefono" required>
                            </div>
                        </div>
                    </form>
                </div>
                
                <!-- Paso 4: Confirmación -->
                <div class="admin-step-content" id="admin-step-4" style="display: none;">
                    <h2>4. Confirmar reserva</h2>
                    
                    <div class="admin-confirmation-details">
                        <div class="admin-confirm-row">
                            <strong>Fecha:</strong> <span id="admin-confirm-fecha"></span>
                        </div>
                        <div class="admin-confirm-row">
                            <strong>Hora:</strong> <span id="admin-confirm-hora"></span>
                        </div>
                        <div class="admin-confirm-row">
                            <strong>Personas:</strong> <span id="admin-confirm-personas"></span>
                        </div>
                        <div class="admin-confirm-row">
                            <strong>Cliente:</strong> <span id="admin-confirm-cliente"></span>
                        </div>
                        <div class="admin-confirm-row">
                            <strong>Email:</strong> <span id="admin-confirm-email"></span>
                        </div>
                        <div class="admin-confirm-row">
                            <strong>Total:</strong> <span id="admin-confirm-total"></span>
                        </div>
                    </div>
                </div>
                
                <!-- Navegación -->
                <div class="admin-navigation">
                    <button id="admin-btn-anterior" class="btn-secondary" onclick="adminPreviousStep()" style="display: none;">← Anterior</button>
                    <div class="admin-step-info">
                        <span id="admin-step-text">Paso 1 de 4: Seleccionar fecha y horario</span>
                    </div>
                    <button id="admin-btn-siguiente" class="btn-primary" onclick="adminNextStep()" disabled>Siguiente →</button>
                    <button id="admin-btn-confirmar" class="btn-success" onclick="adminConfirmReservation()" style="display: none;">Confirmar Reserva</button>
                </div>
            </div>
        </div>
        
        <style>
        .admin-reserva-rapida {
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .admin-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #0073aa;
        }
        
        .admin-header h1 {
            color: #23282d;
            margin: 0;
        }
        
        .admin-steps-container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .admin-step-indicator {
            display: flex;
            background: #f8f9fa;
            border-bottom: 1px solid #eee;
        }
        
        .admin-step {
            flex: 1;
            padding: 20px;
            text-align: center;
            border-right: 1px solid #eee;
            transition: all 0.3s;
        }
        
        .admin-step:last-child {
            border-right: none;
        }
        
        .admin-step.active {
            background: #0073aa;
            color: white;
        }
        
        .admin-step-number {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background: #ddd;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 10px;
            font-weight: bold;
        }
        
        .admin-step.active .admin-step-number {
            background: white;
            color: #0073aa;
        }
        
        .admin-step-title {
            font-size: 14px;
            font-weight: 600;
        }
        
        .admin-step-content {
            padding: 30px;
        }
        
        .admin-step-content h2 {
            color: #23282d;
            margin-bottom: 20px;
        }
        
        .admin-calendar-section {
            margin-bottom: 30px;
        }
        
        .admin-calendar-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .admin-calendar-controls button {
            padding: 10px 20px;
            background: #0073aa;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .admin-calendar-controls h3 {
            margin: 0;
            color: #23282d;
        }
        
        .admin-calendar-container {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
        }
        
        #admin-calendar-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 2px;
        }
        
        .calendar-day-header {
            background: #0073aa;
            color: white;
            padding: 10px;
            text-align: center;
            font-weight: bold;
        }
        
        .calendar-day {
            background: white;
            padding: 10px;
            text-align: center;
            cursor: pointer;
            min-height: 40px;
            border: 2px solid transparent;
            transition: all 0.3s;
        }
        
        .calendar-day:hover {
            background: #f0f0f0;
        }
        
        .calendar-day.disponible {
            background: #e8f5e8;
            color: #155724;
        }
        
        .calendar-day.disponible:hover {
            background: #d4edda;
        }
        
        .calendar-day.selected {
            background: #0073aa !important;
            color: white !important;
            border-color: #005177;
        }
        
        .calendar-day.no-disponible {
            background: #f8f8f8;
            color: #999;
            cursor: not-allowed;
        }
        
        .calendar-day.blocked-day {
            background: #ffeaa7;
            color: #856404;
            cursor: not-allowed;
        }
        
        .calendar-day.oferta {
            background: #fff3cd;
            color: #856404;
        }
        
        .calendar-day.other-month {
            background: #f8f9fa;
            color: #999;
        }
        
        .admin-schedule-section {
            margin-bottom: 30px;
        }
        
        .admin-schedule-section label {
            display: block;
            margin-bottom: 10px;
            font-weight: 600;
        }
        
        .admin-schedule-section select {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 4px;
            font-size: 16px;
        }
        
        .admin-persons-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .admin-person-selector {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        
        .admin-person-selector label {
            display: block;
            margin-bottom: 10px;
            font-weight: 600;
        }
        
        .admin-person-selector input {
            width: 80px;
            padding: 8px;
            text-align: center;
            border: 2px solid #ddd;
            border-radius: 4px;
            font-size: 16px;
            margin-bottom: 10px;
        }
        
        .admin-price {
            display: block;
            font-weight: bold;
            color: #0073aa;
        }
        
        .admin-pricing-summary {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        
        .admin-discount-row, .admin-total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        
        .admin-total-row {
            font-size: 20px;
            font-weight: bold;
            color: #0073aa;
            border-top: 2px solid #ddd;
            padding-top: 10px;
        }
        
        .admin-discount-message {
            background: #d4edda;
            color: #155724;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            display: none;
        }
        
        .admin-discount-message.show {
            display: block;
        }
        
        .admin-client-form {
            max-width: 600px;
        }
        
        .admin-form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .admin-form-group {
            display: flex;
            flex-direction: column;
        }
        
        .admin-form-group label {
            margin-bottom: 5px;
            font-weight: 600;
        }
        
        .admin-form-group input {
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 4px;
            font-size: 16px;
        }
        
        .admin-form-group input:focus {
            outline: none;
            border-color: #0073aa;
        }
        
        .admin-confirmation-details {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        
        .admin-confirm-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
        }
        
        .admin-confirm-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }
        
        .admin-navigation {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 30px;
            background: #f8f9fa;
            border-top: 1px solid #eee;
        }
        
        .admin-step-info {
            font-weight: 600;
            color: #23282d;
        }
        
        .btn-primary, .btn-secondary, .btn-success {
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s;
        }
        
        .btn-primary {
            background: #0073aa;
            color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
            background: #005177;
        }
        
        .btn-primary:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        
        .btn-secondary:hover {
            background: #5a6268;
        }
        
        .btn-success {
            background: #28a745;
            color: white;
        }
        
        .btn-success:hover {
            background: #218838;
        }
        
        @media (max-width: 768px) {
            .admin-form-row {
                grid-template-columns: 1fr;
            }
            
            .admin-persons-grid {
                grid-template-columns: 1fr;
            }
            
            .admin-navigation {
                flex-direction: column;
                gap: 10px;
            }
        }
        </style>
    `;

    // Inicializar calendario y eventos
    loadAdminSystemConfiguration().then(() => {
        loadAdminCalendar();
        setupAdminEventListeners();
    });
}



/**
 * Función principal para procesar reserva rápida
 */
function processReservaRapida(callbackOnError) {
    console.log('=== INICIANDO PROCESS RESERVA RÁPIDA ===');

    try {
        // Recopilar datos del formulario
        const formData = {
            action: 'process_reserva_rapida',
            nonce: reservasAjax.nonce,
            // Datos del cliente
            nombre: document.getElementById('nombre').value.trim(),
            apellidos: document.getElementById('apellidos').value.trim(),
            email: document.getElementById('email').value.trim(),
            telefono: document.getElementById('telefono').value.trim(),
            // Datos del servicio
            service_id: document.getElementById('service_id').value,
            // Datos de personas
            adultos: parseInt(document.getElementById('adultos').value) || 0,
            residentes: parseInt(document.getElementById('residentes').value) || 0,
            ninos_5_12: parseInt(document.getElementById('ninos_5_12').value) || 0,
            ninos_menores: parseInt(document.getElementById('ninos_menores').value) || 0
        };

        console.log('Datos a enviar:', formData);

        // Validaciones del lado cliente
        const validation = validateReservaRapidaData(formData);
        if (!validation.valid) {
            showError(validation.error);
            if (callbackOnError) callbackOnError();
            return;
        }

        // Enviar solicitud AJAX
        jQuery.ajax({
            url: reservasAjax.ajax_url,
            type: 'POST',
            data: formData,
            timeout: 30000, // 30 segundos timeout
            success: function (response) {
                console.log('Respuesta del servidor:', response);

                if (response.success) {
                    handleReservaRapidaSuccess(response.data);
                } else {
                    showError('Error procesando reserva: ' + response.data);
                    if (callbackOnError) callbackOnError();
                }
            },
            error: function (xhr, status, error) {
                console.error('Error AJAX:', status, error);

                let errorMessage = 'Error de conexión';
                if (status === 'timeout') {
                    errorMessage = 'La solicitud tardó demasiado tiempo. Por favor, inténtalo de nuevo.';
                } else if (xhr.responseJSON && xhr.responseJSON.data) {
                    errorMessage = xhr.responseJSON.data;
                }

                showError(errorMessage);
                if (callbackOnError) callbackOnError();
            }
        });

    } catch (error) {
        console.error('Error en processReservaRapida:', error);
        showError('Error interno: ' + error.message);
        if (callbackOnError) callbackOnError();
    }
}

/**
 * Validar datos del formulario del lado cliente
 */
function validateReservaRapidaData(data) {
    // Validar datos del cliente
    if (!data.nombre || data.nombre.length < 2) {
        return { valid: false, error: 'El nombre debe tener al menos 2 caracteres' };
    }

    if (!data.apellidos || data.apellidos.length < 2) {
        return { valid: false, error: 'Los apellidos deben tener al menos 2 caracteres' };
    }

    if (!data.email || !isValidEmail(data.email)) {
        return { valid: false, error: 'Email no válido' };
    }

    if (!data.telefono || data.telefono.length < 9) {
        return { valid: false, error: 'Teléfono debe tener al menos 9 dígitos' };
    }

    // Validar servicio
    if (!data.service_id) {
        return { valid: false, error: 'Debe seleccionar un servicio' };
    }

    // Validar personas
    const totalPersonas = data.adultos + data.residentes + data.ninos_5_12;

    if (totalPersonas === 0) {
        return { valid: false, error: 'Debe haber al menos una persona que ocupe plaza' };
    }

    if (data.ninos_5_12 > 0 && (data.adultos + data.residentes) === 0) {
        return { valid: false, error: 'Debe haber al menos un adulto si hay niños' };
    }

    // Validar disponibilidad de plazas
    const serviceSelect = document.getElementById('service_id');
    const selectedOption = serviceSelect.selectedOptions[0];
    if (selectedOption) {
        const plazasDisponibles = parseInt(selectedOption.dataset.plazas);
        if (totalPersonas > plazasDisponibles) {
            return {
                valid: false,
                error: `Solo quedan ${plazasDisponibles} plazas disponibles, necesitas ${totalPersonas}`
            };
        }
    }

    return { valid: true };
}

/**
 * Manejar respuesta exitosa de reserva rápida
 */
function handleReservaRapidaSuccess(data) {
    console.log('=== RESERVA RÁPIDA EXITOSA ===');
    console.log('Datos de respuesta:', data);

    // Mostrar mensaje de éxito con detalles
    const successMessage = `
        <div style="text-align: center; padding: 30px; background: #d4edda; border: 2px solid #28a745; border-radius: 12px; margin: 20px 0;">
            <h3 style="color: #155724; margin: 0 0 15px 0; font-size: 24px;">
                ✅ ¡RESERVA RÁPIDA PROCESADA EXITOSAMENTE!
            </h3>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                <h4 style="color: #28a745; margin: 0 0 15px 0;">Detalles de la Reserva:</h4>
                <div style="font-size: 16px; line-height: 1.6; color: #2d2d2d;">
                    <strong>Localizador:</strong> <span style="font-family: monospace; background: #f8f9fa; padding: 4px 8px; border-radius: 4px; font-size: 18px; color: #28a745; font-weight: bold;">${data.localizador}</span><br>
                    <strong>Cliente:</strong> ${document.getElementById('nombre').value} ${document.getElementById('apellidos').value}<br>
                    <strong>Email:</strong> ${document.getElementById('email').value}<br>
                    <strong>Fecha:</strong> ${formatDateForDisplay(data.detalles.fecha)}<br>
                    <strong>Hora:</strong> ${data.detalles.hora}<br>
                    <strong>Personas:</strong> ${data.detalles.personas}<br>
                    <strong>Total:</strong> <span style="color: #28a745; font-weight: bold; font-size: 18px;">${data.detalles.precio_final}€</span><br>
                    <strong>Procesado por:</strong> ${data.admin_user}
                </div>
            </div>
            
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
                <p style="margin: 0; color: #1976d2; font-weight: 600;">
                    📧 Emails enviados automáticamente:
                </p>
                <ul style="margin: 10px 0 0 0; color: #1976d2; text-align: left; display: inline-block;">
                    <li>Confirmación al cliente (con PDF adjunto)</li>
                    <li>Notificación al super administrador</li>
                </ul>
            </div>
            
            <div style="margin-top: 25px;">
                <button onclick="loadReportsSection()" style="background: #28a745; color: white; border: none; padding: 12px 25px; border-radius: 6px; margin-right: 10px; cursor: pointer; font-weight: 600;">
                    📊 Ver en Informes
                </button>
                <button onclick="createNewReservaRapida()" style="background: #007bff; color: white; border: none; padding: 12px 25px; border-radius: 6px; margin-right: 10px; cursor: pointer; font-weight: 600;">
                    ➕ Nueva Reserva Rápida
                </button>
                <button onclick="loadDashboardSection('dashboard')" style="background: #6c757d; color: white; border: none; padding: 12px 25px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    🏠 Volver al Dashboard
                </button>
            </div>
        </div>
    `;

    // Mostrar el mensaje de éxito
    document.getElementById('dashboard-content').innerHTML = successMessage;

    // Hacer scroll hacia arriba para ver el mensaje
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Log para debugging
    console.log('✅ Reserva rápida completada exitosamente');
    console.log('Localizador:', data.localizador);
    console.log('Admin:', data.admin_user);
}

/**
 * Crear nueva reserva rápida
 */
function createNewReservaRapida() {
    loadReservaRapidaSection();
}

/**
 * Función auxiliar para validar email
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Función auxiliar para formatear fecha
 */
function formatDateForDisplay(dateString) {
    try {
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        return dateString;
    }
}

/**
 * Funciones auxiliares para mostrar mensajes (si no existen ya)
 */
if (typeof showError === 'undefined') {
    function showError(message) {
        const messagesDiv = document.getElementById('form-messages');
        if (messagesDiv) {
            messagesDiv.innerHTML = `<div class="error-message" style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #dc3545;">${message}</div>`;
        } else {
            console.error('Error:', message);
            alert('Error: ' + message);
        }
    }
}

if (typeof showSuccess === 'undefined') {
    function showSuccess(message) {
        const messagesDiv = document.getElementById('form-messages');
        if (messagesDiv) {
            messagesDiv.innerHTML = `<div class="success-message" style="background: #d4edda; color: #155724; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #28a745;">${message}</div>`;
        } else {
            console.log('Success:', message);
        }
    }
}

if (typeof clearMessages === 'undefined') {
    function clearMessages() {
        const messagesDiv = document.getElementById('form-messages');
        if (messagesDiv) {
            messagesDiv.innerHTML = '';
        }
    }
}

/**
 * Función específica para cargar Reserva Rápida en dashboard de agencias
 */
function loadAgencyReservaRapida() {
    console.log('=== CARGANDO RESERVA RÁPIDA PARA AGENCIA ===');

    // Mostrar indicador de carga
    showLoadingInContent();

    // Cargar la reserva rápida usando AJAX
    jQuery.ajax({
        url: reservasAjax.ajax_url,
        type: 'POST',
        data: {
            action: 'get_agency_reserva_rapida_form',
            nonce: reservasAjax.nonce
        },
        success: function (response) {
            if (response.success) {
                if (response.data.action === 'initialize_agency_reserva_rapida') {
                    // Inicializar reserva rápida con flujo de calendario
                    initAgencyReservaRapida();
                } else {
                    showErrorInContent('Error: Respuesta inesperada del servidor');
                }
            } else {
                showErrorInContent('Error cargando reserva rápida: ' + response.data);
            }
        },
        error: function (xhr, status, error) {
            console.error('Error AJAX:', error);
            showErrorInContent('Error de conexión cargando reserva rápida');
        }
    });
}

function showErrorInContent(message) {
    document.body.innerHTML = `
       <div class="error-container" style="text-align: center; padding: 50px;">
           <h2 style="color: #d63638;">Error</h2>
           <p style="color: #d63638;">${message}</p>
           <button class="btn-secondary" onclick="location.reload()">← Recargar Página</button>
       </div>
   `;
}


// Agregar al archivo: wp-content/plugins/sistema-reservas/assets/js/dashboard-script.js

/**
 * Función para cargar el perfil de la agencia
 */
function loadAgencyProfile() {
    console.log('=== CARGANDO PERFIL DE AGENCIA ===');

    // Mostrar indicador de carga
    showLoadingInMainContent();

    // Cargar datos del perfil
    jQuery.ajax({
        url: reservasAjax.ajax_url,
        type: 'POST',
        data: {
            action: 'get_agency_profile',
            nonce: reservasAjax.nonce
        },
        success: function (response) {
            console.log('Respuesta del servidor:', response);

            if (response.success) {
                renderAgencyProfile(response.data);
            } else {
                showErrorInMainContent('Error cargando perfil: ' + response.data);
            }
        },
        error: function (xhr, status, error) {
            console.error('Error AJAX:', error);
            showErrorInMainContent('Error de conexión al cargar perfil');
        }
    });
}

/**
 * Renderizar la sección de perfil de agencia
 */
function renderAgencyProfile(agencyData) {
    const content = `
        <div class="agency-profile-management">
            <div class="section-header">
                <h2>👤 Mi Perfil</h2>
                <p>Gestiona la información de tu agencia</p>
            </div>
            
            <div class="profile-actions">
                <button class="btn-primary" onclick="saveAgencyProfile()">
                    💾 Guardar Cambios
                </button>
                <button class="btn-secondary" onclick="goBackToDashboard()">
                    ← Volver al Dashboard
                </button>
            </div>
            
            <div class="profile-form-container">
                <form id="agency-profile-form" class="profile-form">
                    
                    <!-- Información Básica -->
                    <div class="form-section">
                        <h3>🏢 Información Básica</h3>
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="agency_name">Nombre de la Agencia *</label>
                                <input type="text" id="agency_name" name="agency_name" 
                                       value="${escapeHtml(agencyData.agency_name)}" required disabled>
                            </div>
                            <div class="form-group">
                                <label for="contact_person">Persona de Contacto *</label>
                                <input type="text" id="contact_person" name="contact_person" 
                                       value="${escapeHtml(agencyData.contact_person)}" required disabled>
                            </div>
                        </div>
                    </div>

                    <!-- Información de Contacto -->
                    <div class="form-section">
                        <h3>📧 Información de Contacto</h3>
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="email">Email de Contacto *</label>
                                <input type="email" id="email" name="email" 
                                       value="${escapeHtml(agencyData.email)}" required disabled>
                                <small class="form-help">Email principal de la agencia</small>
                            </div>
                            <div class="form-group">
                                <label for="phone">Teléfono</label>
                                <input type="tel" id="phone" name="phone" 
                                       value="${escapeHtml(agencyData.phone || '')}" placeholder="957 123 456" disabled>
                            </div>
                        </div>
                    </div>

                    <!-- Información Fiscal -->
                    <div class="form-section">
            <h3>🏛️ Información Fiscal</h3>
            <div class="form-grid">
                <div class="form-group">
                    <label for="razon_social">Razón Social</label>
                    <input type="text" id="razon_social" name="razon_social" 
                           value="${escapeHtml(agencyData.razon_social || '')}" 
                           placeholder="Denominación social oficial" disabled>
                </div>
                <div class="form-group">
                    <label for="cif">CIF/NIF</label>
                    <input type="text" id="cif" name="cif" 
                           value="${escapeHtml(agencyData.cif || '')}" 
                           placeholder="B12345678" disabled>
                </div>
                <div class="form-group form-group-full">
                    <label for="domicilio_fiscal">Domicilio Fiscal</label>
                    <input type="text" id="domicilio_fiscal" name="domicilio_fiscal" 
                           value="${escapeHtml(agencyData.domicilio_fiscal || '')}"
                           placeholder="Dirección fiscal completa" disabled>
                </div>
            </div>
        </div>

                    <!-- Notificaciones -->
                    <div class="form-section">
                        <h3>🔔 Configuración de Notificaciones</h3>
                        <div class="form-group">
                            <label for="email_notificaciones">Email para Notificaciones de Compras</label>
                            <input type="email" id="email_notificaciones" name="email_notificaciones" 
                                   value="${escapeHtml(agencyData.email_notificaciones || '')}" 
                                   placeholder="notificaciones@agencia.com">
                            <small class="form-help">A este email llegarán las notificaciones de nuevas reservas realizadas por tu agencia. Si se deja vacío, se usará el email de contacto principal.</small>
                        </div>
                    </div>

                    <!-- Dirección -->
                    <div class="form-section">
                        <h3>📍 Dirección</h3>
                        <div class="form-group">
                            <label for="address">Dirección Completa</label>
                            <textarea disabled id="address" name="address" rows="3" 
                                      placeholder="Calle, número, código postal, ciudad...">${escapeHtml(agencyData.address || '')}</textarea>
                        </div>
                    </div>

                    <!-- Notas -->
                    <div class="form-section">
                        <h3>📝 Notas Adicionales</h3>
                        <div class="form-group">
                            <label for="notes">Notas Internas</label>
                            <textarea id="notes" name="notes" rows="4" 
                                      placeholder="Información adicional sobre la agencia..." disabled>${escapeHtml(agencyData.notes || '')}</textarea>
                            <small class="form-help">Estas notas son visibles solo para los administradores</small>
                        </div>
                    </div>

                    <!-- Información de Solo Lectura -->
                    <div class="form-section readonly-section">
            <h3>ℹ️ Información de la Cuenta</h3>
            <div class="readonly-grid">
                <div class="readonly-item">
                    <label>Usuario de Acceso:</label>
                    <span class="readonly-value">${escapeHtml(agencyData.username)}</span>
                </div>
                <div class="readonly-item">
                    <label>Estado:</label>
                    <span class="readonly-value status-${agencyData.status}">${getStatusText(agencyData.status)}</span>
                </div>
                <div class="readonly-item">
                    <label>Fecha de Creación:</label>
                    <span class="readonly-value">${formatDate(agencyData.created_at)}</span>
                </div>
            </div>
        </div>

                </form>
            </div>

            <!-- Mensaje de estado -->
            <div id="profile-messages" class="profile-messages"></div>
        </div>
        
        <style>
        .agency-profile-management {
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .section-header h2 {
            margin: 0 0 10px 0;
            color: #23282d;
        }
        
        .section-header p {
            margin: 0 0 30px 0;
            color: #666;
        }
        
        .profile-actions {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
            align-items: center;
        }
        
        .profile-form-container {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .profile-form {
            padding: 0;
        }
        
        .form-section {
            padding: 30px;
            border-bottom: 1px solid #eee;
        }
        
        .form-section:last-child {
            border-bottom: none;
        }
        
        .form-section h3 {
            margin: 0 0 20px 0;
            color: #0073aa;
            font-size: 18px;
            font-weight: 600;
            padding-bottom: 10px;
            border-bottom: 2px solid #0073aa;
        }
        
        .form-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        
        .form-group {
            display: flex;
            flex-direction: column;
        }
        
        .form-group label {
            font-weight: 600;
            margin-bottom: 5px;
            color: #23282d;
        }
        
        .form-group input,
        .form-group textarea {
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            transition: border-color 0.3s;
        }
        
        .form-group input:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: #0073aa;
            box-shadow: 0 0 0 3px rgba(0, 115, 170, 0.1);
        }
        
        .form-group input:required:invalid {
            border-color: #dc3545;
        }
        
        .form-group input:required:valid {
            border-color: #28a745;
        }
        
        .form-help {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
            font-style: italic;
        }
        
        .readonly-section {
            background: #f8f9fa;
        }
        
        .readonly-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
        }
        
        .readonly-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            background: white;
            border-radius: 4px;
            border-left: 4px solid #0073aa;
        }
        
        .readonly-item label {
            font-weight: 600;
            color: #23282d;
        }
        
        .readonly-value {
            font-weight: 500;
            color: #666;
        }
        
        .readonly-value.status-active {
            color: #28a745;
            font-weight: 600;
        }
        
        .readonly-value.status-inactive {
            color: #dc3545;
            font-weight: 600;
        }
        
        .readonly-value.status-suspended {
            color: #ffc107;
            font-weight: 600;
        }
        
        .readonly-note {
            margin-top: 20px;
            padding: 15px;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            color: #856404;
        }
        
        .profile-messages {
            margin-top: 20px;
        }
        
        .message {
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
        }
        
        .message.success {
            background: #d4edda;
            color: #155724;
            border-left: 4px solid #28a745;
        }
        
        .message.error {
            background: #f8d7da;
            color: #721c24;
            border-left: 4px solid #dc3545;
        }
        
        .message.info {
            background: #d1ecf1;
            color: #0c5460;
            border-left: 4px solid #17a2b8;
        }
        
        @media (max-width: 768px) {
            .agency-profile-management {
                padding: 10px;
            }
            
            .profile-actions {
                flex-direction: column;
                align-items: stretch;
            }
            
            .profile-actions button {
                width: 100%;
            }
            
            .form-grid {
                grid-template-columns: 1fr;
            }
            
            .readonly-grid {
                grid-template-columns: 1fr;
            }
        }
        
        /* Animaciones */
        .form-group input,
        .form-group textarea {
            transition: all 0.3s ease;
        }
        
        .form-group input:focus,
        .form-group textarea:focus {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 115, 170, 0.2);
        }
        
        .readonly-item {
            transition: background-color 0.3s ease;
        }
        
        .readonly-item:hover {
            background-color: #f8f9fa;
        }
        </style>
    `;

    // Insertar contenido en el dashboard principal
    jQuery('.dashboard-content').html(content);

    // Almacenar datos originales para reset
    window.originalAgencyData = { ...agencyData };

    // Inicializar eventos
    initializeProfileEvents();
}

function initializeProfileEvents() {
    // Validación en tiempo real
    jQuery('#agency_name, #contact_person, #email').on('input', function () {
        validateRequiredField(this);
    });

    // Validación de email
    jQuery('#email, #email_notificaciones').on('blur', function () {
        validateEmailField(this);
    });

    // Validación de teléfono
    jQuery('#phone').on('input', function () {
        validatePhoneField(this);
    });

    // Detectar cambios para mostrar indicador
    jQuery('#agency-profile-form input, #agency-profile-form textarea').on('input', function () {
        showUnsavedChangesIndicator();
    });
}

/**
 * Validar campo requerido
 */
function validateRequiredField(field) {
    const value = field.value.trim();

    if (value.length === 0) {
        field.style.borderColor = '#dc3545';
        return false;
    } else if (value.length < 2) {
        field.style.borderColor = '#ffc107';
        return false;
    } else {
        field.style.borderColor = '#28a745';
        return true;
    }
}

/**
 * Validar campo de email
 */
function validateEmailField(field) {
    const value = field.value.trim();

    if (value === '') {
        field.style.borderColor = field.required ? '#dc3545' : '#ddd';
        return !field.required;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(value)) {
        field.style.borderColor = '#28a745';
        return true;
    } else {
        field.style.borderColor = '#dc3545';
        return false;
    }
}

/**
 * Validar campo de teléfono
 */
function validatePhoneField(field) {
    const value = field.value.trim();

    if (value === '') {
        field.style.borderColor = '#ddd';
        return true;
    }

    if (value.length >= 9) {
        field.style.borderColor = '#28a745';
        return true;
    } else {
        field.style.borderColor = '#ffc107';
        return false;
    }
}

/**
 * Mostrar indicador de cambios no guardados
 */
function showUnsavedChangesIndicator() {
    const messagesDiv = jQuery('#profile-messages');
    messagesDiv.html(`
        <div class="message info">
            <strong>💡 Cambios detectados:</strong> Hay cambios sin guardar en el formulario.
        </div>
    `);
}

/**
 * Guardar perfil de agencia
 */
function saveAgencyProfile() {
    console.log('=== GUARDANDO PERFIL DE AGENCIA ===');

    // Validar formulario
    if (!validateProfileForm()) {
        return;
    }

    // Mostrar indicador de carga
    showProfileMessage('info', '⏳ Guardando cambios...');

    // Deshabilitar botón
    const saveBtn = jQuery('button[onclick="saveAgencyProfile()"]');
    const originalText = saveBtn.text();
    saveBtn.prop('disabled', true).text('💾 Guardando...');

    // Recopilar datos del formulario
    const formData = {
        action: 'save_agency_profile',
        agency_name: jQuery('#agency_name').val().trim(),
        contact_person: jQuery('#contact_person').val().trim(),
        email: jQuery('#email').val().trim(),
        phone: jQuery('#phone').val().trim(),
        email_notificaciones: jQuery('#email_notificaciones').val().trim(),
        // ✅ AÑADIR ESTOS CAMPOS QUE FALTABAN:
        razon_social: jQuery('#razon_social').val().trim(),
        cif: jQuery('#cif').val().trim(),
        domicilio_fiscal: jQuery('#domicilio_fiscal').val().trim(),
        address: jQuery('#address').val().trim(),
        notes: jQuery('#notes').val().trim(),
        nonce: reservasAjax.nonce
    };

    console.log('Datos a enviar:', formData);

    // Enviar datos
    jQuery.ajax({
        url: reservasAjax.ajax_url,
        type: 'POST',
        data: formData,
        success: function (response) {
            console.log('Respuesta:', response);

            // Rehabilitar botón
            saveBtn.prop('disabled', false).text(originalText);

            if (response.success) {
                showProfileMessage('success', '✅ ' + response.data);

                // Actualizar datos originales
                window.originalAgencyData = { ...formData };

                // Actualizar datos de sesión si es necesario
                updateSessionData();

            } else {
                showProfileMessage('error', '❌ Error: ' + response.data);
            }
        },
        error: function (xhr, status, error) {
            console.error('Error AJAX:', error);

            // Rehabilitar botón
            saveBtn.prop('disabled', false).text(originalText);

            showProfileMessage('error', '❌ Error de conexión al guardar los cambios');
        }
    });
}

/**
 * Validar formulario completo
 */
function validateProfileForm() {
    let isValid = true;
    const errors = [];

    // Validar nombre de agencia
    const agencyName = jQuery('#agency_name').val().trim();
    if (agencyName.length < 2) {
        errors.push('El nombre de la agencia debe tener al menos 2 caracteres');
        isValid = false;
    }

    // Validar persona de contacto
    const contactPerson = jQuery('#contact_person').val().trim();
    if (contactPerson.length < 2) {
        errors.push('La persona de contacto debe tener al menos 2 caracteres');
        isValid = false;
    }

    // Validar email principal
    const email = jQuery('#email').val().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errors.push('El email de contacto no es válido');
        isValid = false;
    }

    // Validar email de notificaciones si está presente
    const emailNotifications = jQuery('#email_notificaciones').val().trim();
    if (emailNotifications && !emailRegex.test(emailNotifications)) {
        errors.push('El email de notificaciones no es válido');
        isValid = false;
    }

    // Validar teléfono si está presente
    const phone = jQuery('#phone').val().trim();
    if (phone && phone.length < 9) {
        errors.push('El teléfono debe tener al menos 9 dígitos');
        isValid = false;
    }

    // Mostrar errores si los hay
    if (!isValid) {
        showProfileMessage('error', '❌ Errores de validación:<br>• ' + errors.join('<br>• '));
    }

    return isValid;
}

/**
 * Resetear cambios del perfil
 */
function resetAgencyProfile() {
    if (confirm('¿Estás seguro de que quieres descartar todos los cambios?')) {
        // Restaurar valores originales
        if (window.originalAgencyData) {
            jQuery('#agency_name').val(window.originalAgencyData.agency_name || '');
            jQuery('#contact_person').val(window.originalAgencyData.contact_person || '');
            jQuery('#email').val(window.originalAgencyData.email || '');
            jQuery('#phone').val(window.originalAgencyData.phone || '');
            jQuery('#email_notificaciones').val(window.originalAgencyData.email_notificaciones || '');
            jQuery('#address').val(window.originalAgencyData.address || '');
            jQuery('#notes').val(window.originalAgencyData.notes || '');

            // Limpiar mensajes
            jQuery('#profile-messages').html('');

            // Resetear estilos de validación
            jQuery('#agency-profile-form input, #agency-profile-form textarea').css('border-color', '#ddd');

            showProfileMessage('info', '🔄 Formulario reseteado a los valores originales');
        }
    }
}

/**
 * Mostrar mensaje de perfil
 */
function showProfileMessage(type, message) {
    const messagesDiv = jQuery('#profile-messages');
    messagesDiv.html(`<div class="message ${type}">${message}</div>`);

    // Scroll suave hacia el mensaje
    messagesDiv[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Actualizar datos de sesión
 */
function updateSessionData() {
    // Actualizar datos de sesión para reflejar cambios en el header
    jQuery.ajax({
        url: reservasAjax.ajax_url,
        type: 'POST',
        data: {
            action: 'refresh_session_data',
            nonce: reservasAjax.nonce
        },
        success: function (response) {
            if (response.success) {
                console.log('✅ Datos de sesión actualizados');
            }
        }
    });
}

/**
 * Funciones auxiliares reutilizadas
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStatusText(status) {
    const statusMap = {
        'active': 'Activa',
        'inactive': 'Inactiva',
        'suspended': 'Suspendida'
    };
    return statusMap[status] || status;
}

function formatDate(dateString) {
    if (!dateString) return '-';

    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
}

function showLoadingInMainContent() {
    jQuery('.dashboard-content').html('<div class="loading">Cargando Mi Perfil...</div>');
}

function showErrorInMainContent(message) {
    jQuery('.dashboard-content').html(`<div class="error">${message}</div>`);
}

// Exponer función globalmente
window.loadAgencyProfile = loadAgencyProfile;



/**
 * FUNCIÓN HELPER PARA VALIDACIÓN DE EMAILS
 */
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * FUNCIÓN HELPER PARA FORMATO DE FECHAS
 */
function formatDateForProfile(dateString) {
    if (!dateString) return '-';

    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
}


function showEditReservationModal(reservaId) {
    // Crear modal si no existe
    if (!document.getElementById('editReservationModal')) {
        createEditReservationModal();
    }

    // Resetear modal
    document.getElementById('edit-reservation-id').value = reservaId;
    document.getElementById('edit-calendar-grid').innerHTML = '<div class="loading">Cargando calendario...</div>';
    document.getElementById('edit-horarios-select').innerHTML = '<option value="">Selecciona primero una fecha</option>';
    document.getElementById('edit-horarios-select').disabled = true;
    document.getElementById('edit-btn-confirmar').disabled = true;

    // Mostrar modal
    document.getElementById('editReservationModal').style.display = 'block';

    // Cargar calendario para el mes actual
    loadEditReservationCalendar(new Date());
}

function createEditReservationModal() {
    const modalHtml = `
        <div id="editReservationModal" class="modal" style="display: none;">
            <div class="modal-content" style="max-width: 800px;">
                <span class="close" onclick="closeEditReservationModal()">&times;</span>
                <h3>✏️ Editar Fecha y Horario de Reserva</h3>
                
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ffc107;">
                    <p style="margin: 0; color: #856404; font-weight: bold;">
                        ⚠️ Solo se puede cambiar la fecha y horario del servicio.
                    </p>
                    <p style="margin: 5px 0 0 0; color: #856404; font-size: 14px;">
                        El número de personas se mantendrá igual. Se enviará un nuevo email de confirmación al cliente.
                    </p>
                </div>
                
                <form id="editReservationForm">
                    <input type="hidden" id="edit-reservation-id">
                    
                    <!-- Navegación del calendario -->
                    <div class="edit-calendar-controls" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <button type="button" onclick="changeEditMonth(-1)">← Mes Anterior</button>
                        <h4 id="edit-current-month-year"></h4>
                        <button type="button" onclick="changeEditMonth(1)">Siguiente Mes →</button>
                    </div>
                    
                    <!-- Calendario -->
                    <div class="edit-calendar-container" style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                        <div id="edit-calendar-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;">
                            <!-- Calendario se cargará aquí -->
                        </div>
                    </div>
                    
                    <!-- Selector de horarios -->
                    <div class="form-group">
                        <label for="edit-horarios-select">Horarios disponibles:</label>
                        <select id="edit-horarios-select" disabled>
                            <option value="">Selecciona primero una fecha</option>
                        </select>
                    </div>
                    
                    <div class="form-actions" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                        <button type="button" class="btn-secondary" onclick="closeEditReservationModal()">
                            Cancelar
                        </button>
                        <button type="submit" id="edit-btn-confirmar" class="btn-primary" disabled>
                            ✅ Confirmar Cambio
                        </button>
                    </div>
                </form>
            </div>
        </div>
        
        <style>
        .edit-calendar-container .calendar-day-header {
            background: #0073aa;
            color: white;
            padding: 10px;
            text-align: center;
            font-weight: bold;
        }
        
        .edit-calendar-container .calendar-day {
            background: white;
            padding: 10px;
            text-align: center;
            cursor: pointer;
            min-height: 40px;
            border: 2px solid transparent;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .edit-calendar-container .calendar-day:hover {
            background: #f0f0f0;
        }
        
        .edit-calendar-container .calendar-day.disponible {
            background: #e8f5e8;
            color: #155724;
            cursor: pointer;
        }
        
        .edit-calendar-container .calendar-day.disponible:hover {
            background: #d4edda;
        }
        
        .edit-calendar-container .calendar-day.selected {
            background: #0073aa !important;
            color: white !important;
            border-color: #005177;
        }
        
        .edit-calendar-container .calendar-day.no-disponible {
            background: #f8f8f8;
            color: #999;
            cursor: not-allowed;
        }
        
        .edit-calendar-container .calendar-day.blocked-day {
            background: #ffeaa7;
            color: #856404;
            cursor: not-allowed;
        }
        
        .edit-calendar-container .calendar-day.other-month {
            background: #f8f9fa;
            color: #999;
        }
            /* Añadir estos estilos dentro del <style> existente o crear uno nuevo */

/* Resaltar filtros activos */
.filter-group select[value="si"],
.filter-group select[value="compra"] {
    border-color: #0073aa;
    box-shadow: 0 0 0 2px rgba(0, 115, 170, 0.1);
}

/* Indicador visual para filtros especiales */
.filter-group select option[value="si"] {
    background-color: #fff3cd;
    color: #856404;
}

.filter-group select option[value="compra"] {
    background-color: #e3f2fd;
    color: #1976d2;
}

/* Mejorar la tabla para reservas canceladas */
.reservations-table-data tbody tr.reservation-cancelled {
    background: linear-gradient(90deg, #f8d7da 0%, #ffffff 100%);
}

.reservations-table-data tbody tr.reservation-cancelled:hover {
    background: linear-gradient(90deg, #f1b0b7 0%, #f8f9fa 100%);
}

/* Estadísticas por estado más visible */
.stats-by-status h4 {
    color: #856404;
    font-size: 16px;
    text-align: center;
    border-bottom: 2px solid #ffc107;
    padding-bottom: 10px;
    margin-bottom: 20px;
}

.status-stat-card .stat-amount {
    font-size: 14px;
    color: #666;
    font-weight: normal;
}

/* Indicadores visuales para diferentes tipos de fecha */
.table-header h4 {
    position: relative;
    padding-left: 25px;
}

.table-header h4:before {
    content: "📅";
    position: absolute;
    left: 0;
    font-size: 18px;
}

/* Responsive para filtros */
@media (max-width: 768px) {
    .filters-row {
        grid-template-columns: 1fr;
        gap: 15px;
    }
    
    .filter-group {
        margin-bottom: 10px;
    }
    
    .stats-by-status {
        grid-template-columns: 1fr;
    }
}
        </style>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Añadir evento al formulario
    document.getElementById('editReservationForm').addEventListener('submit', function (e) {
        e.preventDefault();
        processReservationEdit();
    });

    // Evento para selector de horarios
    document.getElementById('edit-horarios-select').addEventListener('change', function () {
        document.getElementById('edit-btn-confirmar').disabled = !this.value;
    });
}

let editCurrentDate = new Date();
let editServicesData = {};
let editSelectedDate = null;

function loadEditReservationCalendar(date) {
    editCurrentDate = date;
    updateEditCalendarHeader();

    const reservaId = document.getElementById('edit-reservation-id').value;

    const formData = new FormData();
    formData.append('action', 'get_available_services_for_edit');
    formData.append('month', date.getMonth() + 1);
    formData.append('year', date.getFullYear());
    formData.append('current_reservation_id', reservaId);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                editServicesData = data.data;
                renderEditCalendar();
            } else {
                console.error('Error cargando servicios para edición:', data.data);
                document.getElementById('edit-calendar-grid').innerHTML = '<div class="error">Error cargando servicios: ' + data.data + '</div>';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('edit-calendar-grid').innerHTML = '<div class="error">Error de conexión</div>';
        });
}

function updateEditCalendarHeader() {
    const monthNames = [
        'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];

    const monthYear = monthNames[editCurrentDate.getMonth()] + ' ' + editCurrentDate.getFullYear();
    document.getElementById('edit-current-month-year').textContent = monthYear;
}

function renderEditCalendar() {
    const year = editCurrentDate.getFullYear();
    const month = editCurrentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let firstDayOfWeek = firstDay.getDay();
    firstDayOfWeek = (firstDayOfWeek + 6) % 7; // Lunes = 0

    const daysInMonth = lastDay.getDate();
    const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

    let calendarHTML = '';

    // Encabezados de días
    dayNames.forEach(day => {
        calendarHTML += `<div class="calendar-day-header">${day}</div>`;
    });

    // Días del mes anterior
    for (let i = 0; i < firstDayOfWeek; i++) {
        const dayNum = new Date(year, month, -firstDayOfWeek + i + 1).getDate();
        calendarHTML += `<div class="calendar-day other-month">${dayNum}</div>`;
    }

    // Días del mes actual
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        let dayClass = 'calendar-day';
        let clickHandler = '';

        if (editServicesData[dateStr] && editServicesData[dateStr].length > 0) {
            dayClass += ' disponible';
            clickHandler = `onclick="selectEditDate('${dateStr}')"`;
        } else {
            dayClass += ' no-disponible';
        }

        if (editSelectedDate === dateStr) {
            dayClass += ' selected';
        }

        calendarHTML += `<div class="${dayClass}" ${clickHandler}>${day}</div>`;
    }

    document.getElementById('edit-calendar-grid').innerHTML = calendarHTML;
}

function changeEditMonth(direction) {
    editCurrentDate.setMonth(editCurrentDate.getMonth() + direction);
    loadEditReservationCalendar(editCurrentDate);
}

function selectEditDate(dateStr) {
    editSelectedDate = dateStr;

    // Actualizar visual del calendario
    document.querySelectorAll('#edit-calendar-grid .calendar-day').forEach(day => {
        day.classList.remove('selected');
    });
    event.target.classList.add('selected');

    // Cargar horarios disponibles
    loadEditAvailableSchedules(dateStr);
}

function loadEditAvailableSchedules(dateStr) {
    const services = editServicesData[dateStr] || [];

    let optionsHTML = '<option value="">Selecciona un horario</option>';

    services.forEach(service => {
        let descuentoInfo = '';
        if (service.tiene_descuento && parseFloat(service.porcentaje_descuento) > 0) {
            descuentoInfo = ` (${service.porcentaje_descuento}% descuento)`;
        }

        const plazasDisponibles = parseInt(service.plazas_disponibles);
        const horaVuelta = service.hora_vuelta ? ` - Vuelta: ${service.hora_vuelta.substring(0, 5)}` : '';

        optionsHTML += `<option value="${service.id}">
            ${service.hora.substring(0, 5)}${horaVuelta} - ${plazasDisponibles} plazas disponibles${descuentoInfo}
        </option>`;
    });

    document.getElementById('edit-horarios-select').innerHTML = optionsHTML;
    document.getElementById('edit-horarios-select').disabled = false;
    document.getElementById('edit-btn-confirmar').disabled = true;
}

function processReservationEdit() {
    const reservaId = document.getElementById('edit-reservation-id').value;
    const nuevoServicioId = document.getElementById('edit-horarios-select').value;

    if (!reservaId || !nuevoServicioId) {
        alert('Faltan datos necesarios para actualizar la reserva');
        return;
    }

    if (!confirm('¿Estás seguro de que quieres cambiar la fecha y horario de esta reserva?\n\nSe enviará un nuevo email de confirmación al cliente.')) {
        return;
    }

    // Deshabilitar botón
    const confirmBtn = document.getElementById('edit-btn-confirmar');
    const originalText = confirmBtn.textContent;
    confirmBtn.disabled = true;
    confirmBtn.textContent = '⏳ Actualizando...';

    const formData = new FormData();
    formData.append('action', 'update_reservation_service');
    formData.append('reserva_id', reservaId);
    formData.append('nuevo_servicio_id', nuevoServicioId);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            // Rehabilitar botón
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalText;

            if (data.success) {
                alert('✅ ' + data.data);
                closeEditReservationModal();

                // Recargar la lista actual
                const activeTab = document.querySelector('.tab-btn.active');
                if (activeTab && activeTab.textContent.includes('Reservas')) {
                    loadReservationsByDate();
                } else if (activeTab && activeTab.textContent.includes('Buscar')) {
                    searchReservations();
                }
            } else {
                alert('❌ Error: ' + data.data);
            }
        })
        .catch(error => {
            // Rehabilitar botón
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalText;

            console.error('Error:', error);
            alert('❌ Error de conexión al actualizar la reserva');
        });
}

function closeEditReservationModal() {
    document.getElementById('editReservationModal').style.display = 'none';
}

// Exponer funciones globalmente
window.showEditReservationModal = showEditReservationModal;
window.closeEditReservationModal = closeEditReservationModal;
window.changeEditMonth = changeEditMonth;
window.selectEditDate = selectEditDate;
window.processReservationEdit = processReservationEdit;


/**
 * FUNCIÓN PARA MOSTRAR NOTIFICACIONES TEMPORALES
 */
function showTemporaryNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `temporary-notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
        color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
        padding: 15px 20px;
        border-radius: 6px;
        border-left: 4px solid ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        animation: slideIn 0.3s ease-out;
    `;

    notification.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: inherit; cursor: pointer; font-size: 18px; margin-left: 10px;">×</button>
        </div>
    `;

    document.body.appendChild(notification);

    // Auto-eliminar después del tiempo especificado
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, duration);
}

// Agregar animaciones CSS para las notificaciones
const animationCSS = `
@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes slideOut {
    from {
        transform: translateX(0);
        opacity: 1;
    }
    to {
        transform: translateX(100%);
        opacity: 0;
    }
}
`;

// Agregar estilos al documento
if (!document.getElementById('agency-profile-styles')) {
    const style = document.createElement('style');
    style.id = 'agency-profile-styles';
    style.textContent = animationCSS;
    document.head.appendChild(style);
}


function initAgencyReservaRapida() {
    console.log('=== INICIALIZANDO RESERVA RÁPIDA AGENCIA (NUEVO FLUJO) ===');

    // Mostrar interfaz de reserva rápida CON ESTILOS CSS INCLUIDOS
    document.body.innerHTML = `
        <div class="admin-reserva-rapida">
            <div class="admin-header">
                <h1>⚡ Reserva Rápida - Agencia</h1>
                <div class="admin-actions">
                    <button class="btn-secondary" onclick="goBackToDashboard()">← Volver al Dashboard</button>
                </div>
            </div>
            
            <div class="admin-steps-container">
                <div class="admin-step-indicator">
                    <div class="admin-step active" id="agency-step-1-indicator">
                        <div class="admin-step-number">1</div>
                        <div class="admin-step-title">Fecha y Hora</div>
                    </div>
                    <div class="admin-step" id="agency-step-2-indicator">
                        <div class="admin-step-number">2</div>
                        <div class="admin-step-title">Personas</div>
                    </div>
                    <div class="admin-step" id="agency-step-3-indicator">
                        <div class="admin-step-number">3</div>
                        <div class="admin-step-title">Datos Cliente</div>
                    </div>
                    <div class="admin-step" id="agency-step-4-indicator">
                        <div class="admin-step-number">4</div>
                        <div class="admin-step-title">Confirmar</div>
                    </div>
                </div>
                
                <!-- Paso 1: Seleccionar fecha y horario -->
                <div class="admin-step-content" id="agency-step-1">
                    <h2>1. Selecciona fecha y horario</h2>
                    
                    <div class="admin-calendar-section">
                        <div class="admin-calendar-controls">
                            <button id="agency-prev-month">← Mes Anterior</button>
                            <h3 id="agency-current-month-year"></h3>
                            <button id="agency-next-month">Siguiente Mes →</button>
                        </div>
                        
                        <div class="admin-calendar-container">
                            <div id="agency-calendar-grid">
                                <!-- Calendario se cargará aquí -->
                            </div>
                        </div>
                    </div>
                    
                    <div class="admin-schedule-section">
                        <label for="agency-horarios-select">Horarios disponibles:</label>
                        <select id="agency-horarios-select" disabled>
                            <option value="">Selecciona primero una fecha</option>
                        </select>
                    </div>
                </div>
                
                <!-- Paso 2: Seleccionar personas (SIN PRECIOS MOSTRADOS) -->
<div class="admin-step-content" id="agency-step-2" style="display: none;">
    <h2>2. Selecciona el número de personas</h2>
    
    <div class="admin-persons-grid">
        <div class="admin-person-selector">
            <label for="agency-adultos">Adultos:</label>
            <input type="number" id="agency-adultos" min="0" max="50" value="0">
        </div>
        
        <div class="admin-person-selector">
            <label for="agency-residentes">Residentes:</label>
            <input type="number" id="agency-residentes" min="0" max="50" value="0">
        </div>
        
        <div class="admin-person-selector">
            <label for="agency-ninos-5-12">Niños (5-12 años):</label>
            <input type="number" id="agency-ninos-5-12" min="0" max="50" value="0">
        </div>
        
        <div class="admin-person-selector">
            <label for="agency-ninos-menores">Niños (-5 años):</label>
            <input type="number" id="agency-ninos-menores" min="0" max="50" value="0">
            <span class="admin-price">GRATIS</span>
        </div>
    </div>
    


</div>
                
                <!-- Paso 3: Datos del cliente (CON EMAIL OPCIONAL) -->
                <div class="admin-step-content" id="agency-step-3" style="display: none;">
                    <h2>3. Datos del cliente</h2>
                    
                    <form id="agency-client-form" class="admin-client-form">
                        <div class="admin-form-row">
                            <div class="admin-form-group">
                                <label for="agency-nombre">Nombre *</label>
                                <input type="text" id="agency-nombre" name="nombre" required>
                            </div>
                            <div class="admin-form-group">
                                <label for="agency-apellidos">Apellidos *</label>
                                <input type="text" id="agency-apellidos" name="apellidos" required>
                            </div>
                        </div>
                        
                        <div class="admin-form-row">
                            <div class="admin-form-group">
                                <label for="agency-email">Email (opcional)</label>
                                <input type="email" id="agency-email" name="email">
                                <small style="color: #666; font-style: italic;">Si se deja vacío, no se enviará confirmación por email al cliente</small>
                            </div>
                            <div class="admin-form-group">
                                <label for="agency-telefono">Teléfono *</label>
                                <input type="tel" id="agency-telefono" name="telefono" required>
                            </div>
                        </div>
                    </form>
                </div>
                
                <!-- Paso 4: Confirmación -->
                <div class="admin-step-content" id="agency-step-4" style="display: none;">
                    <h2>4. Confirmar reserva</h2>
                    
                    <div class="admin-confirmation-details">
                        <div class="admin-confirm-row">
                            <strong>Fecha:</strong> <span id="agency-confirm-fecha"></span>
                        </div>
                        <div class="admin-confirm-row">
                            <strong>Hora:</strong> <span id="agency-confirm-hora"></span>
                        </div>
                        <div class="admin-confirm-row">
                            <strong>Personas:</strong> <span id="agency-confirm-personas"></span>
                        </div>
                        <div class="admin-confirm-row">
                            <strong>Cliente:</strong> <span id="agency-confirm-cliente"></span>
                        </div>
                        <div class="admin-confirm-row">
                            <strong>Email:</strong> <span id="agency-confirm-email"></span>
                        </div>
                    </div>
                </div>
                
                <!-- Navegación -->
                <div class="admin-navigation">
                    <button id="agency-btn-anterior" class="btn-secondary" onclick="agencyPreviousStep()" style="display: none;">← Anterior</button>
                    <div class="admin-step-info">
                        <span id="agency-step-text">Paso 1 de 4: Seleccionar fecha y horario</span>
                    </div>
                    <button id="agency-btn-siguiente" class="btn-primary" onclick="agencyNextStep()" disabled>Siguiente →</button>
                    <button id="agency-btn-confirmar" class="btn-success" onclick="agencyConfirmReservation()" style="display: none;">Confirmar Reserva</button>
                </div>
            </div>
        </div>
        
        <style>
        .admin-reserva-rapida {
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .admin-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #0073aa;
        }
        
        .admin-header h1 {
            color: #23282d;
            margin: 0;
        }
        
        .admin-steps-container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .admin-step-indicator {
            display: flex;
            background: #f8f9fa;
            border-bottom: 1px solid #eee;
        }
        
        .admin-step {
            flex: 1;
            padding: 20px;
            text-align: center;
            border-right: 1px solid #eee;
            transition: all 0.3s;
        }
        
        .admin-step:last-child {
            border-right: none;
        }
        
        .admin-step.active {
            background: #0073aa;
            color: white;
        }
        
        .admin-step-number {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background: #ddd;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 10px;
            font-weight: bold;
        }
        
        .admin-step.active .admin-step-number {
            background: white;
            color: #0073aa;
        }
        
        .admin-step-title {
            font-size: 14px;
            font-weight: 600;
        }
        
        .admin-step-content {
            padding: 30px;
        }
        
        .admin-step-content h2 {
            color: #23282d;
            margin-bottom: 20px;
        }
        
        .admin-calendar-section {
            margin-bottom: 30px;
        }
        
        .admin-calendar-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .admin-calendar-controls button {
            padding: 10px 20px;
            background: #0073aa;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .admin-calendar-controls h3 {
            margin: 0;
            color: #23282d;
        }
        
        .admin-calendar-container {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
        }
        
        #agency-calendar-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 2px;
        }
        
        .calendar-day-header {
            background: #0073aa;
            color: white;
            padding: 10px;
            text-align: center;
            font-weight: bold;
        }
        
        .calendar-day {
            background: white;
            padding: 10px;
            text-align: center;
            cursor: pointer;
            min-height: 40px;
            border: 2px solid transparent;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .calendar-day:hover {
            background: #f0f0f0;
        }
        
        .calendar-day.disponible {
            background: #e8f5e8;
            color: #155724;
            cursor: pointer;
        }
        
        .calendar-day.disponible:hover {
            background: #d4edda;
        }
        
        .calendar-day.selected {
            background: #0073aa !important;
            color: white !important;
            border-color: #005177;
        }
        
        .calendar-day.no-disponible {
            background: #f8f8f8;
            color: #999;
            cursor: not-allowed;
        }
        
        .calendar-day.blocked-day {
            background: #ffeaa7;
            color: #856404;
            cursor: not-allowed;
        }
        
        .calendar-day.oferta {
            background: #fff3cd;
            color: #856404;
        }
        
        .calendar-day.other-month {
            background: #f8f9fa;
            color: #999;
        }
        
        .admin-schedule-section {
            margin-bottom: 30px;
        }
        
        .admin-schedule-section label {
            display: block;
            margin-bottom: 10px;
            font-weight: 600;
        }
        
        .admin-schedule-section select {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 4px;
            font-size: 16px;
        }
        
        .admin-persons-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .admin-person-selector {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        
        .admin-person-selector label {
            display: block;
            margin-bottom: 10px;
            font-weight: 600;
        }
        
        .admin-person-selector input {
            width: 80px;
            padding: 8px;
            text-align: center;
            border: 2px solid #ddd;
            border-radius: 4px;
            font-size: 16px;
            margin-bottom: 10px;
        }
        
        .admin-price {
            display: block;
            font-weight: bold;
            color: #0073aa;
        }
        
        .admin-pricing-summary {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        
        .admin-discount-row, .admin-total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        
        .admin-total-row {
            font-size: 20px;
            font-weight: bold;
            color: #0073aa;
            border-top: 2px solid #ddd;
            padding-top: 10px;
        }
        
        .admin-discount-message {
            background: #d4edda;
            color: #155724;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            display: none;
        }
        
        .admin-discount-message.show {
            display: block;
        }
        
        .admin-client-form {
            max-width: 600px;
        }
        
        .admin-form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .admin-form-group {
            display: flex;
            flex-direction: column;
        }
        
        .admin-form-group label {
            margin-bottom: 5px;
            font-weight: 600;
        }
        
        .admin-form-group input {
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 4px;
            font-size: 16px;
        }
        
        .admin-form-group input:focus {
            outline: none;
            border-color: #0073aa;
        }
        
        .admin-confirmation-details {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        
        .admin-confirm-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
        }
        
        .admin-confirm-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }
        
        .admin-navigation {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 30px;
            background: #f8f9fa;
            border-top: 1px solid #eee;
        }
        
        .admin-step-info {
            font-weight: 600;
            color: #23282d;
        }
        
        .btn-primary, .btn-secondary, .btn-success {
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s;
        }
        
        .btn-primary {
            background: #0073aa;
            color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
            background: #005177;
        }
        
        .btn-primary:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        
        .btn-secondary:hover {
            background: #5a6268;
        }
        
        .btn-success {
            background: #28a745;
            color: white;
        }
        
        .btn-success:hover {
            background: #218838;
        }
        
        @media (max-width: 768px) {
            .admin-form-row {
                grid-template-columns: 1fr;
            }
            
            .admin-persons-grid {
                grid-template-columns: 1fr;
            }
            
            .admin-navigation {
                flex-direction: column;
                gap: 10px;
            }
        }
        </style>
    `;

    // Inicializar calendario y eventos
    loadAgencySystemConfiguration().then(() => {
        loadAgencyCalendar();
        setupAgencyEventListeners();
    });
}

let agencyCurrentDate = new Date();
let agencySelectedDate = null;
let agencySelectedServiceId = null;
let agencyServicesData = {};
let agencyCurrentStep = 1;
let agencyDiasAnticiapcionMinima = 1;

// Funciones para agencia
function loadAgencySystemConfiguration() {
    return loadAdminSystemConfiguration(); // Reutilizar la misma función
}

function setupAgencyEventListeners() {
    // Navegación del calendario
    document.getElementById('agency-prev-month').addEventListener('click', function () {
        agencyCurrentDate.setMonth(agencyCurrentDate.getMonth() - 1);
        loadAgencyCalendar();
    });

    document.getElementById('agency-next-month').addEventListener('click', function () {
        agencyCurrentDate.setMonth(agencyCurrentDate.getMonth() + 1);
        loadAgencyCalendar();
    });

    // Selección de horario
    document.getElementById('agency-horarios-select').addEventListener('change', function () {
        agencySelectedServiceId = this.value;
        if (agencySelectedServiceId) {
            document.getElementById('agency-btn-siguiente').disabled = false;
            loadAgencyPrices();
        } else {
            document.getElementById('agency-btn-siguiente').disabled = true;
            document.getElementById('agency-total-price').textContent = '0€';
        }
    });

    // Eventos para inputs de personas
    ['agency-adultos', 'agency-residentes', 'agency-ninos-5-12', 'agency-ninos-menores'].forEach(id => {
        const input = document.getElementById(id);
        ['input', 'change', 'keyup', 'blur'].forEach(eventType => {
            input.addEventListener(eventType, function () {
                setTimeout(() => {
                    calculateAgencyTotalPrice();
                    validateAgencyPersonSelectionForNext();
                }, 100);
            });
        });
    });
}

function loadAgencyCalendar() {
    updateAgencyCalendarHeader();

    const formData = new FormData();
    formData.append('action', 'get_available_services');
    formData.append('month', agencyCurrentDate.getMonth() + 1);
    formData.append('year', agencyCurrentDate.getFullYear());
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                agencyServicesData = data.data;
                renderAgencyCalendar();
            } else {
                console.error('Error cargando servicios agency:', data.data);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

function updateAgencyCalendarHeader() {
    const monthNames = [
        'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];

    const monthYear = monthNames[agencyCurrentDate.getMonth()] + ' ' + agencyCurrentDate.getFullYear();
    document.getElementById('agency-current-month-year').textContent = monthYear;
}

function renderAgencyCalendar() {
    const year = agencyCurrentDate.getFullYear();
    const month = agencyCurrentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let firstDayOfWeek = firstDay.getDay();
    firstDayOfWeek = (firstDayOfWeek + 6) % 7; // Lunes = 0

    const daysInMonth = lastDay.getDate();
    const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

    let calendarHTML = '';

    // Encabezados de días
    dayNames.forEach(day => {
        calendarHTML += `<div class="calendar-day-header">${day}</div>`;
    });

    // Días del mes anterior
    for (let i = 0; i < firstDayOfWeek; i++) {
        const dayNum = new Date(year, month, -firstDayOfWeek + i + 1).getDate();
        calendarHTML += `<div class="calendar-day other-month">${dayNum}</div>`;
    }

    // ✅ PARA AGENCIAS: SIN RESTRICCIONES DE DÍAS DE ANTICIPACIÓN
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar hora para comparación

    // Días del mes actual
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayDate = new Date(year, month, day);

        let dayClass = 'calendar-day';
        let clickHandler = '';

        // ✅ SOLO VERIFICAR SI HAY SERVICIOS DISPONIBLES (sin restricción de fecha)
        if (agencyServicesData[dateStr] && agencyServicesData[dateStr].length > 0) {
            dayClass += ' disponible';
            clickHandler = `onclick="selectAgencyDate('${dateStr}')"`;
        } else {
            dayClass += ' no-disponible';
        }

        if (agencySelectedDate === dateStr) {
            dayClass += ' selected';
        }

        calendarHTML += `<div class="${dayClass}" ${clickHandler}>${day}</div>`;
    }

    document.getElementById('agency-calendar-grid').innerHTML = calendarHTML;
}

function agencyNextStep() {
    console.log('Agency: Avanzando al siguiente paso desde', agencyCurrentStep);

    if (agencyCurrentStep === 1) {
        if (!agencySelectedDate || !agencySelectedServiceId) {
            alert('Por favor, selecciona una fecha y horario.');
            return;
        }

        document.getElementById('agency-step-1').style.display = 'none';
        document.getElementById('agency-step-2').style.display = 'block';

        document.getElementById('agency-step-1-indicator').classList.remove('active');
        document.getElementById('agency-step-2-indicator').classList.add('active');

        document.getElementById('agency-btn-anterior').style.display = 'block';
        document.getElementById('agency-btn-siguiente').disabled = true;
        document.getElementById('agency-step-text').textContent = 'Paso 2 de 4: Seleccionar personas';

        agencyCurrentStep = 2;
        loadAgencyPrices();

    } else if (agencyCurrentStep === 2) {
        const adultos = parseInt(document.getElementById('agency-adultos').value) || 0;
        const residentes = parseInt(document.getElementById('agency-residentes').value) || 0;
        const ninos512 = parseInt(document.getElementById('agency-ninos-5-12').value) || 0;
        const ninosMenores = parseInt(document.getElementById('agency-ninos-menores').value) || 0;

        const totalPersonas = adultos + residentes + ninos512 + ninosMenores;

        if (totalPersonas === 0) {
            alert('Debe seleccionar al menos una persona.');
            return;
        }

        if (!validateAgencyPersonSelection()) {
            return;
        }

        document.getElementById('agency-step-2').style.display = 'none';
        document.getElementById('agency-step-3').style.display = 'block';

        document.getElementById('agency-step-2-indicator').classList.remove('active');
        document.getElementById('agency-step-3-indicator').classList.add('active');

        document.getElementById('agency-btn-siguiente').disabled = true;
        document.getElementById('agency-step-text').textContent = 'Paso 3 de 4: Datos del cliente';

        agencyCurrentStep = 3;
        setupAgencyFormValidation();

    } else if (agencyCurrentStep === 3) {
        const form = document.getElementById('agency-client-form');
        if (!form) {
            alert('Error: No se encontró el formulario. Recarga la página e inténtalo de nuevo.');
            return;
        }

        const formData = new FormData(form);
        const nombre = formData.get('nombre') ? formData.get('nombre').trim() : '';
        const apellidos = formData.get('apellidos') ? formData.get('apellidos').trim() : '';
        const email = formData.get('email') ? formData.get('email').trim() : ''; // ✅ PUEDE SER VACÍO
        const telefono = formData.get('telefono') ? formData.get('telefono').trim() : '';

        if (!nombre || !apellidos || !telefono) {
            alert('Por favor, completa todos los campos obligatorios (nombre, apellidos, teléfono).');
            return;
        }

        // ✅ VALIDAR EMAIL SOLO SI NO ESTÁ VACÍO
        if (email && !isValidEmail(email)) {
            alert('Por favor, introduce un email válido o déjalo vacío.');
            return;
        }

        document.getElementById('agency-step-3').style.display = 'none';
        document.getElementById('agency-step-4').style.display = 'block';

        document.getElementById('agency-step-3-indicator').classList.remove('active');
        document.getElementById('agency-step-4-indicator').classList.add('active');

        document.getElementById('agency-btn-siguiente').style.display = 'none';
        document.getElementById('agency-btn-confirmar').style.display = 'block';
        document.getElementById('agency-step-text').textContent = 'Paso 4 de 4: Confirmar reserva';

        agencyCurrentStep = 4;

        setTimeout(() => {
            fillAgencyConfirmationData();
        }, 100);
    }
}

function agencyConfirmReservation() {
    console.log('=== CONFIRMANDO RESERVA RÁPIDA AGENCIA ===');

    if (!confirm('¿Estás seguro de que quieres procesar esta reserva?\n\nSe enviará confirmación por email según corresponda.')) {
        return;
    }

    const confirmBtn = document.getElementById('agency-btn-confirmar');
    const originalText = confirmBtn.textContent;
    confirmBtn.disabled = true;
    confirmBtn.textContent = '⏳ Procesando...';

    // Preparar datos de la reserva
    const service = findAgencyServiceById(agencySelectedServiceId);
    const form = document.getElementById('agency-client-form');
    const formData = new FormData(form);

    const adultos = parseInt(document.getElementById('agency-adultos').value) || 0;
    const residentes = parseInt(document.getElementById('agency-residentes').value) || 0;
    const ninos_5_12 = parseInt(document.getElementById('agency-ninos-5-12').value) || 0;
    const ninos_menores = parseInt(document.getElementById('agency-ninos-menores').value) || 0;

    // Enviar solicitud AJAX usando la nueva acción para agencias
    const ajaxData = {
        action: 'process_agency_reserva_rapida',
        nonce: reservasAjax.nonce,
        nombre: formData.get('nombre'),
        apellidos: formData.get('apellidos'),
        email: formData.get('email') || '', // ✅ PUEDE SER VACÍO
        telefono: formData.get('telefono'),
        service_id: agencySelectedServiceId,
        adultos: adultos,
        residentes: residentes,
        ninos_5_12: ninos_5_12,
        ninos_menores: ninos_menores
    };

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(ajaxData)
    })
        .then(response => response.json())
        .then(data => {
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalText;

            if (data && data.success) {
                console.log('Reserva de agencia procesada exitosamente:', data.data);

                const detalles = data.data.detalles;
                const emailInfo = formData.get('email') ?
                    "\n📧 El cliente recibirá la confirmación por email." :
                    "\nℹ️ No se envió email al cliente (email no proporcionado).";

                const mensaje = "🎉 ¡RESERVA CREADA EXITOSAMENTE! 🎉\n\n" +
                    "📋 LOCALIZADOR: " + data.data.localizador + "\n\n" +
                    "📅 DETALLES:\n" +
                    "• Fecha: " + detalles.fecha + "\n" +
                    "• Hora: " + detalles.hora + "\n" +
                    "• Personas: " + detalles.personas + "\n" +
                    "• Precio: " + detalles.precio_final + "€\n\n" +
                    "✅ La reserva ha sido procesada correctamente." + emailInfo + "\n" +
                    "📧 Tu agencia y el administrador han sido notificados.\n\n" +
                    "¡Reserva de agencia completada!";

                alert(mensaje);

                setTimeout(() => {
                    goBackToDashboard();
                }, 2000);

            } else {
                console.error('Error procesando reserva de agencia:', data);
                const errorMsg = data && data.data ? data.data : 'Error desconocido';
                alert('❌ Error procesando la reserva: ' + errorMsg);
            }
        })
        .catch(error => {
            console.error('Error de conexión:', error);
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalText;
            alert('❌ Error de conexión al procesar la reserva.\n\nPor favor, inténtalo de nuevo.');
        });
}

function agencyPreviousStep() {
    console.log('Agency: Retrocediendo desde paso', agencyCurrentStep);

    if (agencyCurrentStep === 2) {
        document.getElementById('agency-step-2').style.display = 'none';
        document.getElementById('agency-step-1').style.display = 'block';

        document.getElementById('agency-step-2-indicator').classList.remove('active');
        document.getElementById('agency-step-1-indicator').classList.add('active');

        document.getElementById('agency-btn-anterior').style.display = 'none';
        document.getElementById('agency-btn-siguiente').disabled = agencySelectedServiceId ? false : true;
        document.getElementById('agency-step-text').textContent = 'Paso 1 de 4: Seleccionar fecha y horario';

        agencyCurrentStep = 1;

    } else if (agencyCurrentStep === 3) {
        document.getElementById('agency-step-3').style.display = 'none';
        document.getElementById('agency-step-2').style.display = 'block';

        document.getElementById('agency-step-3-indicator').classList.remove('active');
        document.getElementById('agency-step-2-indicator').classList.add('active');

        document.getElementById('agency-btn-siguiente').disabled = false;
        document.getElementById('agency-step-text').textContent = 'Paso 2 de 4: Seleccionar personas';

        agencyCurrentStep = 2;

    } else if (agencyCurrentStep === 4) {
        document.getElementById('agency-step-4').style.display = 'none';
        document.getElementById('agency-step-3').style.display = 'block';

        document.getElementById('agency-step-4-indicator').classList.remove('active');
        document.getElementById('agency-step-3-indicator').classList.add('active');

        document.getElementById('agency-btn-siguiente').style.display = 'block';
        document.getElementById('agency-btn-confirmar').style.display = 'none';
        document.getElementById('agency-btn-siguiente').disabled = false;
        document.getElementById('agency-step-text').textContent = 'Paso 3 de 4: Datos del cliente';

        agencyCurrentStep = 3;
    }
}

function validateAgencyPersonSelection() {
    const adultos = parseInt(document.getElementById('agency-adultos').value) || 0;
    const residentes = parseInt(document.getElementById('agency-residentes').value) || 0;
    const ninos512 = parseInt(document.getElementById('agency-ninos-5-12').value) || 0;
    const ninosMenores = parseInt(document.getElementById('agency-ninos-menores').value) || 0;

    const totalAdults = adultos + residentes;
    const totalChildren = ninos512 + ninosMenores;

    if (totalChildren > 0 && totalAdults === 0) {
        alert('Debe haber al menos un adulto si hay niños en la reserva.');
        document.getElementById('agency-ninos-5-12').value = 0;
        document.getElementById('agency-ninos-menores').value = 0;
        calculateAgencyTotalPrice();
        return false;
    }

    return true;
}

function validateAgencyPersonSelectionForNext() {
    const adultos = parseInt(document.getElementById('agency-adultos').value) || 0;
    const residentes = parseInt(document.getElementById('agency-residentes').value) || 0;
    const ninos512 = parseInt(document.getElementById('agency-ninos-5-12').value) || 0;
    const ninosMenores = parseInt(document.getElementById('agency-ninos-menores').value) || 0;

    const totalAdults = adultos + residentes;
    const totalChildren = ninos512 + ninosMenores;
    const totalPersonas = totalAdults + totalChildren;

    if (totalPersonas === 0) {
        document.getElementById('agency-btn-siguiente').disabled = true;
        return false;
    }

    if (totalChildren > 0 && totalAdults === 0) {
        alert('Debe haber al menos un adulto si hay niños en la reserva.');
        document.getElementById('agency-ninos-5-12').value = 0;
        document.getElementById('agency-ninos-menores').value = 0;
        calculateAgencyTotalPrice();
        document.getElementById('agency-btn-siguiente').disabled = true;
        return false;
    }

    document.getElementById('agency-btn-siguiente').disabled = false;
    return true;
}

function loadAgencyPrices() {
    if (!agencySelectedServiceId) return;

    const service = findAgencyServiceById(agencySelectedServiceId);
    if (service) {
        // ✅ NO MOSTRAR PRECIOS INDIVIDUALES EN LA INTERFAZ
        // Solo calcular el precio total
        calculateAgencyTotalPrice();
    }
}

function findAgencyServiceById(serviceId) {
    for (let date in agencyServicesData) {
        for (let service of agencyServicesData[date]) {
            if (service.id == serviceId) {
                return service;
            }
        }
    }
    return null;
}
function calculateAgencyTotalPrice() {
    if (!agencySelectedServiceId) {
        clearAgencyPricing();
        return;
    }

    const adultos = parseInt(document.getElementById('agency-adultos').value) || 0;
    const residentes = parseInt(document.getElementById('agency-residentes').value) || 0;
    const ninos512 = parseInt(document.getElementById('agency-ninos-5-12').value) || 0;
    const ninosMenores = parseInt(document.getElementById('agency-ninos-menores').value) || 0;

    const totalPersonas = adultos + residentes + ninos512 + ninosMenores;

    if (totalPersonas === 0) {
        document.getElementById('agency-total-discount').textContent = '';
        document.getElementById('agency-total-price').textContent = '0€';
        document.getElementById('agency-discount-row').style.display = 'none';
        document.getElementById('agency-discount-message').classList.remove('show');
        return;
    }

    const formData = new FormData();
    formData.append('action', 'calculate_price');
    formData.append('service_id', agencySelectedServiceId);
    formData.append('adultos', adultos);
    formData.append('residentes', residentes);
    formData.append('ninos_5_12', ninos512);
    formData.append('ninos_menores', ninosMenores);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const result = data.data;
                updateAgencyPricingDisplay(result);
            } else {
                console.error('Error calculando precio agency:', data);
                document.getElementById('agency-total-price').textContent = '0€';
                document.getElementById('agency-total-discount').textContent = '';
                document.getElementById('agency-discount-row').style.display = 'none';
                document.getElementById('agency-discount-message').classList.remove('show');
            }
        })
        .catch(error => {
            console.error('Error calculando precio agency:', error);
            document.getElementById('agency-total-price').textContent = '0€';
            document.getElementById('agency-total-discount').textContent = '';
            document.getElementById('agency-discount-row').style.display = 'none';
            document.getElementById('agency-discount-message').classList.remove('show');
        });
}

function updateAgencyPricingDisplay(result) {
    // ✅ NO MOSTRAR INFORMACIÓN DE DESCUENTOS
    // Solo mostrar el precio total final
    const totalPrice = parseFloat(result.total) || 0;
    document.getElementById('agency-total-price').textContent = totalPrice.toFixed(2) + '€';
}

function clearAgencyPricing() {
    document.getElementById('agency-total-price').textContent = '0€';
}
function setupAgencyFormValidation() {
    const inputs = document.querySelectorAll('#agency-client-form input[required]'); // Solo campos requeridos

    function validateForm() {
        let allValid = true;
        inputs.forEach(input => {
            if (!input.value.trim()) {
                allValid = false;
            }
        });

        // Validar email específicamente SOLO SI NO ESTÁ VACÍO
        const emailInput = document.querySelector('#agency-client-form input[name="email"]');
        if (emailInput.value.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailInput.value.trim())) {
                allValid = false;
            }
        }

        document.getElementById('agency-btn-siguiente').disabled = !allValid;
    }

    inputs.forEach(input => {
        input.addEventListener('input', validateForm);
        input.addEventListener('blur', validateForm);
    });

    // También validar email opcional
    const emailInput = document.querySelector('#agency-client-form input[name="email"]');
    if (emailInput) {
        emailInput.addEventListener('input', validateForm);
        emailInput.addEventListener('blur', validateForm);
    }

    validateForm();
}

function fillAgencyConfirmationData() {
    console.log('=== LLENANDO DATOS DE CONFIRMACIÓN AGENCIA ===');

    if (!agencySelectedServiceId || !agencySelectedDate) {
        console.error('❌ Faltan datos básicos:', {
            serviceId: agencySelectedServiceId,
            selectedDate: agencySelectedDate
        });
        return;
    }

    const service = findAgencyServiceById(agencySelectedServiceId);
    if (!service) {
        console.error('❌ No se encontró el servicio');
        return;
    }

    const nombreInput = document.getElementById('agency-nombre');
    const apellidosInput = document.getElementById('agency-apellidos');
    const emailInput = document.getElementById('agency-email');
    const telefonoInput = document.getElementById('agency-telefono');

    if (!nombreInput || !apellidosInput || !telefonoInput) {
        console.error('❌ No se encontraron los campos del formulario');
        return;
    }

    const nombre = nombreInput.value.trim();
    const apellidos = apellidosInput.value.trim();
    const email = emailInput.value.trim() || 'No proporcionado'; // ✅ MANEJAR EMAIL VACÍO
    const telefono = telefonoInput.value.trim();

    const adultos = parseInt(document.getElementById('agency-adultos').value) || 0;
    const residentes = parseInt(document.getElementById('agency-residentes').value) || 0;
    const ninos512 = parseInt(document.getElementById('agency-ninos-5-12').value) || 0;
    const ninosMenores = parseInt(document.getElementById('agency-ninos-menores').value) || 0;
    const totalPersonas = adultos + residentes + ninos512 + ninosMenores;

    // Formatear fecha
    let fechaFormateada = agencySelectedDate;
    try {
        const fechaObj = new Date(agencySelectedDate + 'T00:00:00');
        fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        fechaFormateada = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
    } catch (e) {
        console.warn('No se pudo formatear la fecha, usando formato original');
    }

    // Crear detalle de personas
    let personasDetalle = [];
    if (adultos > 0) personasDetalle.push(`${adultos} adulto${adultos > 1 ? 's' : ''}`);
    if (residentes > 0) personasDetalle.push(`${residentes} residente${residentes > 1 ? 's' : ''}`);
    if (ninos512 > 0) personasDetalle.push(`${ninos512} niño${ninos512 > 1 ? 's' : ''} (5-12)`);
    if (ninosMenores > 0) personasDetalle.push(`${ninosMenores} bebé${ninosMenores > 1 ? 's' : ''} (gratis)`);

    const personasTexto = personasDetalle.length > 0 ?
        `${totalPersonas} personas (${personasDetalle.join(', ')})` :
        `${totalPersonas} personas`;

    const totalPriceElement = document.getElementById('agency-total-price');
    const precioTotal = totalPriceElement ? totalPriceElement.textContent : '0€';

    // Actualizar elementos de confirmación
    const confirmElements = {
        'agency-confirm-fecha': fechaFormateada,
        'agency-confirm-hora': service.hora,
        'agency-confirm-personas': personasTexto,
        'agency-confirm-cliente': `${nombre} ${apellidos}`,
        'agency-confirm-email': email,
        'agency-confirm-total': precioTotal
    };

    Object.keys(confirmElements).forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = confirmElements[elementId];
        }
    });
}

function selectAgencyDate(dateStr) {
    agencySelectedDate = dateStr;
    agencySelectedServiceId = null;

    // Actualizar visual del calendario
    document.querySelectorAll('#agency-calendar-grid .calendar-day').forEach(day => {
        day.classList.remove('selected');
    });
    event.target.classList.add('selected');

    loadAgencyAvailableSchedules(dateStr);
}

function loadAgencyAvailableSchedules(dateStr) {
    const services = agencyServicesData[dateStr] || [];

    let optionsHTML = '<option value="">Selecciona un horario</option>';

    // ✅ OBTENER FECHA Y HORA ACTUAL
    const now = new Date();
    const selectedDate = new Date(dateStr + 'T00:00:00');
    const isToday = selectedDate.toDateString() === now.toDateString();

    services.forEach(service => {
        let shouldShow = true;

        // ✅ SI ES HOY, VERIFICAR QUE LA HORA NO HAYA PASADO
        if (isToday) {
            // Crear objeto Date con la fecha de hoy y la hora del servicio
            const serviceDateTime = new Date();
            const [hours, minutes] = service.hora.split(':');
            serviceDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

            // Si la hora del servicio ya pasó, no mostrar
            if (serviceDateTime <= now) {
                shouldShow = false;
            }
        }

        // Solo añadir si debe mostrarse
        if (shouldShow) {
            optionsHTML += `<option value="${service.id}" 
                               data-plazas="${service.plazas_disponibles}">
                            ${service.hora} - ${service.plazas_disponibles} plazas disponibles
                        </option>`;
        }
    });

    document.getElementById('agency-horarios-select').innerHTML = optionsHTML;
    document.getElementById('agency-horarios-select').disabled = false;
    document.getElementById('agency-btn-siguiente').disabled = true;
}

window.selectAgencyDate = selectAgencyDate;
window.agencyNextStep = agencyNextStep;
window.agencyPreviousStep = agencyPreviousStep;
window.agencyConfirmReservation = agencyConfirmReservation;
window.initAgencyReservaRapida = initAgencyReservaRapida;

// Función auxiliar para email validation
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}


/**
 * Descargar PDF de ticket desde reports
 */
function downloadTicketPDF(reservaId, localizador) {
    console.log('📄 Descargando PDF para reserva:', reservaId, localizador);

    if (!reservaId || !localizador) {
        alert('❌ Datos de reserva no válidos');
        return;
    }

    // Mostrar indicador de carga
    showPDFLoadingIndicator();

    const formData = new FormData();
    formData.append('action', 'generate_ticket_pdf_from_reports');
    formData.append('reserva_id', reservaId);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            hidePDFLoadingIndicator();

            if (data.success && data.data.pdf_url) {
                console.log('✅ PDF generado exitosamente');

                // Descargar automáticamente
                const link = document.createElement('a');
                link.href = data.data.pdf_url;
                link.download = data.data.filename || `billete_${localizador}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Mostrar mensaje de éxito
                showTemporaryNotification('✅ PDF descargado correctamente', 'success', 3000);
            } else {
                console.error('❌ Error generando PDF:', data.data);
                alert('❌ Error generando el PDF: ' + (data.data || 'Error desconocido'));
            }
        })
        .catch(error => {
            hidePDFLoadingIndicator();
            console.error('❌ Error de conexión:', error);
            alert('❌ Error de conexión al generar el PDF');
        });
}

/**
 * Mostrar indicador de carga para PDF
 */
function showPDFLoadingIndicator() {
    // Crear indicador si no existe
    if (!document.getElementById('pdf-loading-indicator')) {
        const indicator = document.createElement('div');
        indicator.id = 'pdf-loading-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #0073aa;
            color: white;
            padding: 15px 20px;
            border-radius: 6px;
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;

        indicator.innerHTML = `
            <div style="width: 20px; height: 20px; border: 2px solid #ffffff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <span>Generando PDF...</span>
        `;

        // Añadir animación CSS
        if (!document.getElementById('pdf-spinner-style')) {
            const style = document.createElement('style');
            style.id = 'pdf-spinner-style';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(indicator);
    } else {
        document.getElementById('pdf-loading-indicator').style.display = 'flex';
    }
}

/**
 * Ocultar indicador de carga para PDF
 */
function hidePDFLoadingIndicator() {
    const indicator = document.getElementById('pdf-loading-indicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

// Exponer función globalmente
window.downloadTicketPDF = downloadTicketPDF;


/**
 * Cargar sección de "Mis Reservas" para agencias
 */
function loadAgencyReservations() {
    console.log('=== CARGANDO MIS RESERVAS PARA AGENCIA ===');

    // Mostrar indicador de carga
    showLoadingInMainContent();

    // Renderizar la interfaz de "Mis Reservas"
    renderAgencyReservationsSection();
}

/**
 * Renderizar la sección de "Mis Reservas" para agencias
 */
function renderAgencyReservationsSection() {
    const content = `
        <div class="reports-management">
            <div class="reports-header">
                <h1>🎫 Mis Reservas</h1>
                <div class="reports-actions">
                    <button class="btn-primary" onclick="showAgencyQuickStatsModal()">📈 Estadísticas Rápidas</button>
                    <button class="btn-secondary" onclick="goBackToDashboard()">← Volver al Dashboard</button>
                </div>
            </div>
            
            <!-- Pestañas de navegación -->
            <div class="reports-tabs">
                <button class="tab-btn active" onclick="switchAgencyTab('reservations')">🎫 Gestión de Reservas</button>
                <button class="tab-btn" onclick="switchAgencyTab('search')">🔍 Buscar Billetes</button>
                <button class="tab-btn" onclick="switchAgencyTab('analytics')">📊 Análisis por Fechas</button>
            </div>
            
            <!-- Contenido de las pestañas -->
            <div class="tab-content">
                <!-- Pestaña 1: Gestión de Reservas -->
                <div id="tab-agency-reservations" class="tab-panel active">
                    <div class="reservations-section">
                        <h3>Gestión de Mis Reservas con Filtros Avanzados</h3>
                        
                        <!-- Filtros (sin filtro de agencias) -->
                        <div class="advanced-filters">
                            <div class="filters-row">
                                <div class="filter-group">
                                    <label for="agency-fecha-inicio">Fecha Inicio:</label>
                                    <input type="date" id="agency-fecha-inicio" value="${new Date().toISOString().split('T')[0]}">
                                </div>
                                <div class="filter-group">
                                    <label for="agency-fecha-fin">Fecha Fin:</label>
                                    <input type="date" id="agency-fecha-fin" value="${new Date().toISOString().split('T')[0]}">
                                </div>
                                <div class="filter-group">
                                    <label for="agency-tipo-fecha">Tipo de Fecha:</label>
                                    <select id="agency-tipo-fecha">
                                        <option value="servicio">Fecha de Servicio</option>
                                        <option value="compra">Fecha de Compra</option>
                                    </select>
                                </div>
                                <div class="filter-group">
                                    <label for="agency-estado-filtro">Estado de Reservas:</label>
                                    <select id="agency-estado-filtro">
                                        <option value="confirmadas">Solo Confirmadas</option>
                                        <option value="todas">Todas (Confirmadas y Canceladas)</option>
                                        <option value="canceladas">Solo Canceladas</option>
                                    </select>
                                </div>
                                <div class="filter-group">
                                    <button class="btn-primary" onclick="loadAgencyReservationsByDateWithFilters()">🔍 Aplicar Filtros</button>
                                </div>
                            </div>
                        </div>
                        
                        <div id="agency-reservations-stats" class="stats-summary" style="display: none;">
                            <!-- Estadísticas se cargarán aquí -->
                        </div>
                        
                        <div id="agency-reservations-list" class="reservations-table">
                            <!-- Lista de reservas se cargará aquí -->
                        </div>
                        
                        <div id="agency-reservations-pagination" class="pagination-controls">
                            <!-- Paginación se cargará aquí -->
                        </div>
                    </div>
                </div>
                
                <!-- Pestaña 2: Buscar Billetes -->
                <div id="tab-agency-search" class="tab-panel">
                    <div class="search-section">
                        <h3>Buscar Mis Billetes</h3>
                        <div class="search-form">
                            <div class="search-row">
                                <select id="agency-search-type">
                                    <option value="localizador">Localizador</option>
                                    <option value="email">Email</option>
                                    <option value="telefono">Teléfono</option>
                                    <option value="nombre">Nombre/Apellidos</option>
                                    <option value="fecha_emision">Fecha de Emisión</option>
                                    <option value="fecha_servicio">Fecha de Servicio</option>
                                </select>
                                <input type="text" id="agency-search-value" placeholder="Introduce el valor a buscar...">
                                <button class="btn-primary" onclick="searchAgencyReservations()">🔍 Buscar</button>
                            </div>
                        </div>
                        
                        <div id="agency-search-results" class="search-results">
                            <!-- Resultados de búsqueda se cargarán aquí -->
                        </div>
                    </div>
                </div>
                
                <!-- Pestaña 3: Análisis por Fechas -->
                <div id="tab-agency-analytics" class="tab-panel">
                    <div class="analytics-section">
                        <h3>Análisis Estadístico de Mis Reservas</h3>
                        <div class="analytics-filters">
                            <div class="quick-ranges">
                                <h4>Períodos Rápidos:</h4>
                                <button class="range-btn" onclick="loadAgencyRangeStats('7_days')">Últimos 7 días</button>
                                <button class="range-btn" onclick="loadAgencyRangeStats('30_days')">Últimos 30 días</button>
                                <button class="range-btn" onclick="loadAgencyRangeStats('60_days')">Últimos 60 días</button>
                                <button class="range-btn" onclick="loadAgencyRangeStats('this_month')">Este mes</button>
                                <button class="range-btn" onclick="loadAgencyRangeStats('last_month')">Mes pasado</button>
                                <button class="range-btn" onclick="loadAgencyRangeStats('this_year')">Este año</button>
                            </div>
                            
                            <div class="custom-range">
                                <h4>Rango Personalizado:</h4>
                                <input type="date" id="agency-custom-fecha-inicio" placeholder="Fecha inicio">
                                <input type="date" id="agency-custom-fecha-fin" placeholder="Fecha fin">
                                <button class="btn-primary" onclick="loadAgencyCustomRangeStats()">Analizar Período</button>
                            </div>
                        </div>
                        
                        <div id="agency-analytics-results" class="analytics-results">
                            <!-- Resultados de análisis se cargarán aquí -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Modales reutilizados -->
        <div id="agencyQuickStatsModal" class="modal" style="display: none;">
            <div class="modal-content">
                <span class="close" onclick="closeAgencyQuickStatsModal()">&times;</span>
                <h3>📈 Mis Estadísticas Rápidas</h3>
                <div id="agency-quick-stats-content">
                    <div class="loading">Cargando estadísticas...</div>
                </div>
            </div>
        </div>
        
        <div id="agencyReservationDetailsModal" class="modal" style="display: none;">
            <div class="modal-content">
                <span class="close" onclick="closeAgencyReservationDetailsModal()">&times;</span>
                <h3 id="agencyReservationModalTitle">Detalles de Reserva</h3>
                <div id="agency-reservation-details-content">
                    <!-- Contenido se cargará aquí -->
                </div>
            </div>
        </div>
    `;

    // Insertar contenido en el dashboard principal
    jQuery('.dashboard-content').html(content);

    console.log('🔧 Configurando eventos de agency reports...');
    initAgencyReportsEvents();

    console.log('🔄 Iniciando carga de datos de agencia...');
    loadAgencyReservationsByDateWithFilters();
}

/**
 * Inicializar eventos para "Mis Reservas"
 */
function initAgencyReportsEvents() {
    // Evento para cambio automático al seleccionar fechas
    document.getElementById('agency-fecha-inicio').addEventListener('change', function () {
        if (this.value && document.getElementById('agency-fecha-fin').value) {
            loadAgencyReservationsByDateWithFilters();
        }
    });

    document.getElementById('agency-fecha-fin').addEventListener('change', function () {
        if (this.value && document.getElementById('agency-fecha-inicio').value) {
            loadAgencyReservationsByDateWithFilters();
        }
    });

    // Evento para cambio de filtro de estado
    document.getElementById('agency-estado-filtro').addEventListener('change', function () {
        if (document.getElementById('agency-fecha-inicio').value && document.getElementById('agency-fecha-fin').value) {
            loadAgencyReservationsByDateWithFilters();
        }
    });

    // Evento para cambio de tipo de búsqueda
    document.getElementById('agency-search-type').addEventListener('change', function () {
        const searchValue = document.getElementById('agency-search-value');
        const searchType = this.value;

        if (searchType === 'fecha_emision' || searchType === 'fecha_servicio') {
            searchValue.type = 'date';
            searchValue.placeholder = 'Selecciona una fecha';
        } else {
            searchValue.type = 'text';
            searchValue.placeholder = 'Introduce el valor a buscar...';
        }
    });

    // Permitir búsqueda con Enter
    document.getElementById('agency-search-value').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            searchAgencyReservations();
        }
    });
}

/**
 * Cargar reservas de agencia con filtros
 */
function loadAgencyReservationsByDateWithFilters(page = 1) {
    const fechaInicio = document.getElementById('agency-fecha-inicio').value;
    const fechaFin = document.getElementById('agency-fecha-fin').value;
    const tipoFecha = document.getElementById('agency-tipo-fecha').value;
    const estadoFiltro = document.getElementById('agency-estado-filtro').value;

    console.log('=== APLICANDO FILTROS AGENCIA ===');
    console.log('Fecha inicio:', fechaInicio);
    console.log('Fecha fin:', fechaFin);
    console.log('Tipo fecha:', tipoFecha);
    console.log('Estado filtro:', estadoFiltro);

    if (!fechaInicio || !fechaFin) {
        alert('Por favor, selecciona ambas fechas');
        return;
    }

    document.getElementById('agency-reservations-list').innerHTML = '<div class="loading">Cargando mis reservas...</div>';

    const formData = new FormData();
    formData.append('action', 'get_agency_reservations_report');
    formData.append('fecha_inicio', fechaInicio);
    formData.append('fecha_fin', fechaFin);
    formData.append('tipo_fecha', tipoFecha);
    formData.append('estado_filtro', estadoFiltro);
    formData.append('page', page);
    formData.append('nonce', reservasAjax.nonce);

    console.log('Enviando solicitud con filtros...');

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            console.log('Respuesta del servidor:', data);

            if (data.success) {
                console.log('✅ Datos cargados correctamente');
                console.log('Total reservas encontradas:', data.data.stats.total_reservas);
                renderAgencyReservationsReportWithFilters(data.data);
            } else {
                console.error('❌ Error del servidor:', data.data);
                document.getElementById('agency-reservations-list').innerHTML =
                    '<div class="error">Error: ' + data.data + '</div>';
            }
        })
        .catch(error => {
            console.error('❌ Error de conexión:', error);
            document.getElementById('agency-reservations-list').innerHTML =
                '<div class="error">Error de conexión</div>';
        });
}

/**
 * Renderizar reporte de reservas de agencia
 */
function renderAgencyReservationsReportWithFilters(data) {
    // Mostrar estadísticas principales
    const statsHtml = `
        <div class="stats-cards">
            <div class="stat-card">
                <h4>Mis Reservas</h4>
                <div class="stat-number">${data.stats.total_reservas || 0}</div>
            </div>
            <div class="stat-card">
                <h4>Adultos</h4>
                <div class="stat-number">${data.stats.total_adultos || 0}</div>
            </div>
            <div class="stat-card">
                <h4>Residentes</h4>
                <div class="stat-number">${data.stats.total_residentes || 0}</div>
            </div>
            <div class="stat-card">
                <h4>Niños (5-12)</h4>
                <div class="stat-number">${data.stats.total_ninos_5_12 || 0}</div>
            </div>
            <div class="stat-card">
                <h4>Niños (-5)</h4>
                <div class="stat-number">${data.stats.total_ninos_menores || 0}</div>
            </div>
            <div class="stat-card">
                <h4>Mis Ingresos</h4>
                <div class="stat-number">${parseFloat(data.stats.ingresos_totales || 0).toFixed(2)}€</div>
            </div>
        </div>
    `;

    let statsCompleteHtml = statsHtml;

    // Estadísticas por estado
    if (data.stats_por_estado && data.stats_por_estado.length > 0) {
        let statusStatsHtml = '<div class="stats-by-status"><h4 style="grid-column: 1/-1; margin: 0;">📊 Desglose por Estado</h4>';

        data.stats_por_estado.forEach(stat => {
            const statusText = stat.estado === 'confirmada' ? 'Confirmadas' :
                stat.estado === 'cancelada' ? 'Canceladas' :
                    stat.estado === 'pendiente' ? 'Pendientes' : stat.estado;

            statusStatsHtml += `
                <div class="status-stat-card status-${stat.estado}">
                    <h5>${statusText}</h5>
                    <div class="stat-number">${stat.total}</div>
                    <div class="stat-amount">${parseFloat(stat.ingresos || 0).toFixed(2)}€</div>
                </div>
            `;
        });

        statusStatsHtml += '</div>';
        statsCompleteHtml += statusStatsHtml;
    }

    document.getElementById('agency-reservations-stats').innerHTML = statsCompleteHtml;
    document.getElementById('agency-reservations-stats').style.display = 'block';

    // Determinar texto del filtro aplicado
    const tipoFechaText = data.filtros.tipo_fecha === 'compra' ? 'Fecha de Compra' : 'Fecha de Servicio';

    let estadoText = '';
    switch (data.filtros.estado_filtro) {
        case 'confirmadas':
            estadoText = ' (solo confirmadas)';
            break;
        case 'canceladas':
            estadoText = ' (solo canceladas)';
            break;
        case 'todas':
            estadoText = ' (todas las reservas)';
            break;
    }

    // Mostrar tabla de reservas
    let tableHtml = `
        <div class="table-header">
            <h4>Mis Reservas por ${tipoFechaText}: ${data.filtros.fecha_inicio} al ${data.filtros.fecha_fin}${estadoText}</h4>
        </div>
        <table class="reservations-table-data">
            <thead>
                <tr>
                    <th>Localizador</th>
                    <th>Fecha Servicio</th>
                    <th>Fecha Compra</th>
                    <th>Hora</th>
                    <th>Cliente</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Personas</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (data.reservas && data.reservas.length > 0) {
        data.reservas.forEach(reserva => {
            const fechaServicioFormateada = new Date(reserva.fecha).toLocaleDateString('es-ES');
            const fechaCompraFormateada = new Date(reserva.created_at).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            const personasDetalle = `A:${reserva.adultos} R:${reserva.residentes} N:${reserva.ninos_5_12} B:${reserva.ninos_menores}`;

            // Clase CSS para el estado
            let estadoClass = 'status-confirmada';
            let rowClass = '';
            if (reserva.estado === 'cancelada') {
                estadoClass = 'status-cancelada';
                rowClass = 'reservation-cancelled';
            }
            if (reserva.estado === 'pendiente') {
                estadoClass = 'status-pendiente';
            }

            tableHtml += `
               <tr class="${rowClass}">
                   <td><strong>${reserva.localizador}</strong></td>
                   <td>${fechaServicioFormateada}</td>
                   <td><small>${fechaCompraFormateada}</small></td>
                   <td>${reserva.hora}</td>
                   <td>${reserva.nombre} ${reserva.apellidos}</td>
                   <td>${reserva.email}</td>
                   <td>${reserva.telefono}</td>
                   <td title="Adultos: ${reserva.adultos}, Residentes: ${reserva.residentes}, Niños 5-12: ${reserva.ninos_5_12}, Menores: ${reserva.ninos_menores}">${personasDetalle}</td>
                   <td><strong>${parseFloat(reserva.precio_final).toFixed(2)}€</strong></td>
                   <td><span class="status-badge ${estadoClass}">${reserva.estado.toUpperCase()}</span></td>
                   <td>
    <button class="btn-small btn-info" onclick="showAgencyReservationDetails(${reserva.id})" title="Ver detalles">👁️</button>
    <button class="btn-small btn-success" onclick="downloadAgencyTicketPDF(${reserva.id}, '${reserva.localizador}')" title="Descargar PDF">📄</button>
    ${reserva.estado !== 'cancelada' ?
                    `<button class="btn-small btn-warning" onclick="showAgencyCancelReservationModal(${reserva.id}, '${reserva.localizador}')" title="Solicitar cancelación">❌</button>` :
                    `<span class="btn-small" style="background: #6c757d; color: white;">CANCELADA</span>`
                }
</td>
               </tr>
           `;
        });
    } else {
        tableHtml += `
           <tr>
               <td colspan="11" style="text-align: center; padding: 40px; color: #666;">
                   No se encontraron reservas con los filtros aplicados
               </td>
           </tr>
       `;
    }

    tableHtml += `</tbody></table>`;

    document.getElementById('agency-reservations-list').innerHTML = tableHtml;

    // Mostrar paginación
    if (data.pagination && data.pagination.total_pages > 1) {
        renderAgencyPaginationWithFilters(data.pagination);
    } else {
        document.getElementById('agency-reservations-pagination').innerHTML = '';
    }
}

/**
 * Renderizar paginación de agencia
 */
function renderAgencyPaginationWithFilters(pagination) {
    let paginationHtml = '<div class="pagination">';

    // Botón anterior
    if (pagination.current_page > 1) {
        paginationHtml += `<button class="btn-pagination" onclick="loadAgencyReservationsByDateWithFilters(${pagination.current_page - 1})">« Anterior</button>`;
    }

    // Números de página
    for (let i = 1; i <= pagination.total_pages; i++) {
        if (i === pagination.current_page) {
            paginationHtml += `<button class="btn-pagination active">${i}</button>`;
        } else {
            paginationHtml += `<button class="btn-pagination" onclick="loadAgencyReservationsByDateWithFilters(${i})">${i}</button>`;
        }
    }

    // Botón siguiente
    if (pagination.current_page < pagination.total_pages) {
        paginationHtml += `<button class="btn-pagination" onclick="loadAgencyReservationsByDateWithFilters(${pagination.current_page + 1})">Siguiente »</button>`;
    }

    paginationHtml += `</div>
       <div class="pagination-info">
           Página ${pagination.current_page} de ${pagination.total_pages} 
           (${pagination.total_items} reservas total)
       </div>`;

    document.getElementById('agency-reservations-pagination').innerHTML = paginationHtml;
}

/**
* Cambiar pestañas de agencia
*/
function switchAgencyTab(tabName) {
    // Ocultar todas las pestañas
    document.querySelectorAll('#tab-agency-reservations, #tab-agency-search, #tab-agency-analytics').forEach(panel => {
        panel.classList.remove('active');
    });

    // Quitar clase active de todos los botones
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Mostrar pestaña seleccionada
    document.getElementById('tab-agency-' + tabName).classList.add('active');

    // Activar botón correspondiente
    event.target.classList.add('active');
}

/**
* Buscar reservas de agencia
*/
function searchAgencyReservations() {
    const searchType = document.getElementById('agency-search-type').value;
    const searchValue = document.getElementById('agency-search-value').value.trim();

    if (!searchValue) {
        alert('Por favor, introduce un valor para buscar');
        return;
    }

    document.getElementById('agency-search-results').innerHTML = '<div class="loading">Buscando mis reservas...</div>';

    const formData = new FormData();
    formData.append('action', 'search_agency_reservations');
    formData.append('search_type', searchType);
    formData.append('search_value', searchValue);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderAgencySearchResults(data.data);
            } else {
                document.getElementById('agency-search-results').innerHTML =
                    '<div class="error">Error: ' + data.data + '</div>';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('agency-search-results').innerHTML =
                '<div class="error">Error de conexión</div>';
        });
}

/**
* Renderizar resultados de búsqueda de agencia
*/
function renderAgencySearchResults(data) {
    let resultsHtml = `
       <div class="search-header">
           <h4>Resultados de búsqueda: ${data.total_found} reservas encontradas</h4>
           <p>Búsqueda por <strong>${data.search_type}</strong>: "${data.search_value}"</p>
       </div>
   `;

    if (data.reservas && data.reservas.length > 0) {
        resultsHtml += `
           <table class="search-results-table">
               <thead>
                   <tr>
                       <th>Localizador</th>
                       <th>Fecha Servicio</th>
                       <th>Cliente</th>
                       <th>Email</th>
                       <th>Teléfono</th>
                       <th>Personas</th>
                       <th>Total</th>
                       <th>Acciones</th>
                   </tr>
               </thead>
               <tbody>
       `;

        data.reservas.forEach(reserva => {
            const fechaFormateada = new Date(reserva.fecha).toLocaleDateString('es-ES');
            const personasDetalle = `A:${reserva.adultos} R:${reserva.residentes} N:${reserva.ninos_5_12} B:${reserva.ninos_menores}`;

            resultsHtml += `
               <tr>
                   <td><strong>${reserva.localizador}</strong></td>
                   <td>${fechaFormateada}</td>
                   <td>${reserva.nombre} ${reserva.apellidos}</td>
                   <td>${reserva.email}</td>
                   <td>${reserva.telefono}</td>
                   <td title="Adultos: ${reserva.adultos}, Residentes: ${reserva.residentes}, Niños 5-12: ${reserva.ninos_5_12}, Menores: ${reserva.ninos_menores}">${personasDetalle}</td>
                   <td><strong>${parseFloat(reserva.precio_final).toFixed(2)}€</strong></td>
                   <td>
    <button class="btn-small btn-info" onclick="showAgencyReservationDetails(${reserva.id})" title="Ver detalles">👁️</button>
    <button class="btn-small btn-success" onclick="downloadAgencyTicketPDF(${reserva.id}, '${reserva.localizador}')" title="Descargar PDF">📄</button>
    ${reserva.estado !== 'cancelada' ?
                    `<button class="btn-small btn-warning" onclick="showAgencyCancelReservationModal(${reserva.id}, '${reserva.localizador}')" title="Solicitar cancelación">❌</button>` :
                    `<span class="btn-small" style="background: #6c757d; color: white;">CANCELADA</span>`
                }
</td>
               </tr>
           `;
        });

        resultsHtml += `
               </tbody>
           </table>
       `;
    } else {
        resultsHtml += `
           <div class="no-results">
               <p>No se encontraron reservas con los criterios especificados.</p>
           </div>
       `;
    }

    document.getElementById('agency-search-results').innerHTML = resultsHtml;
}

/**
* Cargar estadísticas por rango para agencia
*/
function loadAgencyRangeStats(rangeType) {
    document.getElementById('agency-analytics-results').innerHTML = '<div class="loading">Cargando análisis...</div>';

    const formData = new FormData();
    formData.append('action', 'get_agency_date_range_stats');
    formData.append('range_type', rangeType);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderAgencyAnalyticsResults(data.data);
            } else {
                document.getElementById('agency-analytics-results').innerHTML =
                    '<div class="error">Error: ' + data.data + '</div>';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('agency-analytics-results').innerHTML =
                '<div class="error">Error de conexión</div>';
        });
}

/**
* Cargar estadísticas personalizadas para agencia
*/
function loadAgencyCustomRangeStats() {
    const fechaInicio = document.getElementById('agency-custom-fecha-inicio').value;
    const fechaFin = document.getElementById('agency-custom-fecha-fin').value;

    if (!fechaInicio || !fechaFin) {
        alert('Por favor, selecciona ambas fechas');
        return;
    }

    document.getElementById('agency-analytics-results').innerHTML = '<div class="loading">Cargando análisis...</div>';

    const formData = new FormData();
    formData.append('action', 'get_agency_date_range_stats');
    formData.append('range_type', 'custom');
    formData.append('fecha_inicio', fechaInicio);
    formData.append('fecha_fin', fechaFin);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderAgencyAnalyticsResults(data.data);
            } else {
                document.getElementById('agency-analytics-results').innerHTML =
                    '<div class="error">Error: ' + data.data + '</div>';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('agency-analytics-results').innerHTML =
                '<div class="error">Error de conexión</div>';
        });
}

/**
* Renderizar resultados de análisis para agencia
*/
function renderAgencyAnalyticsResults(data) {
    const stats = data.stats;
    const promedioPersonasPorReserva = stats.total_reservas > 0 ?
        (parseFloat(stats.total_personas_con_plaza) / parseFloat(stats.total_reservas)).toFixed(1) : 0;

    let analyticsHtml = `
       <div class="analytics-summary">
           <h4>📊 Mis Estadísticas del Período: ${data.fecha_inicio} al ${data.fecha_fin}</h4>
           
           <div class="analytics-stats-grid">
               <div class="analytics-stat-card">
                   <h5>Mis Reservas</h5>
                   <div class="analytics-stat-number">${stats.total_reservas || 0}</div>
               </div>
               <div class="analytics-stat-card">
                   <h5>Mis Ingresos</h5>
                   <div class="analytics-stat-number">${parseFloat(stats.ingresos_totales || 0).toFixed(2)}€</div>
               </div>
               <div class="analytics-stat-card">
                   <h5>Descuentos Aplicados</h5>
                   <div class="analytics-stat-number">${parseFloat(stats.descuentos_totales || 0).toFixed(2)}€</div>
               </div>
               <div class="analytics-stat-card">
                   <h5>Precio Promedio</h5>
                   <div class="analytics-stat-number">${parseFloat(stats.precio_promedio || 0).toFixed(2)}€</div>
               </div>
           </div>
           
           <div class="people-breakdown">
               <h5>👥 Distribución de Personas</h5>
               <div class="people-stats">
                   <div class="people-stat">
                       <span class="people-label">Adultos:</span>
                       <span class="people-number">${stats.total_adultos || 0}</span>
                   </div>
                   <div class="people-stat">
                       <span class="people-label">Residentes:</span>
                       <span class="people-number">${stats.total_residentes || 0}</span>
                   </div>
                   <div class="people-stat">
                       <span class="people-label">Niños (5-12):</span>
                       <span class="people-number">${stats.total_ninos_5_12 || 0}</span>
                   </div>
                   <div class="people-stat">
                       <span class="people-label">Niños menores:</span>
                       <span class="people-number">${stats.total_ninos_menores || 0}</span>
                   </div>
                   <div class="people-stat total">
                       <span class="people-label">Total con plaza:</span>
                       <span class="people-number">${stats.total_personas_con_plaza || 0}</span>
                   </div>
               </div>
               <p><strong>Promedio personas por reserva:</strong> ${promedioPersonasPorReserva}</p>
           </div>
       </div>
   `;

    // Agregar gráfico simple de reservas por día si hay datos
    if (data.reservas_por_dia && data.reservas_por_dia.length > 0) {
        analyticsHtml += `
           <div class="daily-chart">
               <h5>📈 Mis Reservas por Día</h5>
               <div class="chart-container">
       `;

        data.reservas_por_dia.forEach(dia => {
            const fecha = new Date(dia.fecha).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit'
            });
            analyticsHtml += `
               <div class="chart-bar">
                   <div class="bar-value">${dia.reservas_dia}</div>
                   <div class="bar" style="height: ${Math.max(dia.reservas_dia * 20, 10)}px;"></div>
                   <div class="bar-label">${fecha}</div>
               </div>
           `;
        });

        analyticsHtml += `
               </div>
           </div>
       `;
    }

    document.getElementById('agency-analytics-results').innerHTML = analyticsHtml;
}

/**
* Mostrar modal de estadísticas rápidas para agencia
*/
function showAgencyQuickStatsModal() {
    document.getElementById('agency-quick-stats-content').innerHTML = '<div class="loading">📊 Cargando mis estadísticas...</div>';
    document.getElementById('agencyQuickStatsModal').style.display = 'block';

    // Cargar estadísticas
    loadAgencyQuickStats();
}

/**
* Cargar estadísticas rápidas para agencia
*/
function loadAgencyQuickStats() {
    const formData = new FormData();
    formData.append('action', 'get_agency_quick_stats');
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderAgencyQuickStats(data.data);
            } else {
                document.getElementById('agency-quick-stats-content').innerHTML =
                    '<div class="error">❌ Error cargando estadísticas: ' + data.data + '</div>';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('agency-quick-stats-content').innerHTML =
                '<div class="error">❌ Error de conexión</div>';
        });
}

/**
* Renderizar estadísticas rápidas para agencia
*/
function renderAgencyQuickStats(stats) {
    const hoy = new Date().toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Determinar color y emoji para el crecimiento
    let crecimientoColor = '#28a745';
    let crecimientoEmoji = '📈';
    let crecimientoTexto = 'Crecimiento';

    if (stats.ingresos.crecimiento < 0) {
        crecimientoColor = '#dc3545';
        crecimientoEmoji = '📉';
        crecimientoTexto = 'Decrecimiento';
    } else if (stats.ingresos.crecimiento === 0) {
        crecimientoColor = '#ffc107';
        crecimientoEmoji = '➡️';
        crecimientoTexto = 'Sin cambios';
    }

    let html = `
       <div class="quick-stats-container">
           <!-- Resumen Ejecutivo -->
           <div class="stats-summary-header">
               <h4>📊 Mis Estadísticas - ${hoy}</h4>
           </div>
           
           <!-- Métricas Principales -->
           <div class="main-metrics">
               <div class="metric-card today">
                   <div class="metric-icon">🎫</div>
                   <div class="metric-content">
                       <div class="metric-number">${stats.hoy.reservas}</div>
                       <div class="metric-label">Mis Reservas Hoy</div>
                   </div>
               </div>
               
               <div class="metric-card revenue">
                   <div class="metric-icon">💰</div>
                   <div class="metric-content">
                       <div class="metric-number">${parseFloat(stats.ingresos.mes_actual).toFixed(2)}€</div>
                       <div class="metric-label">Mis Ingresos Este Mes</div>
                   </div>
               </div>
               
               <div class="metric-card growth" style="border-left-color: ${crecimientoColor}">
                   <div class="metric-icon">${crecimientoEmoji}</div>
                   <div class="metric-content">
                       <div class="metric-number" style="color: ${crecimientoColor}">
                           ${stats.ingresos.crecimiento > 0 ? '+' : ''}${stats.ingresos.crecimiento.toFixed(1)}%
                       </div>
                       <div class="metric-label">${crecimientoTexto} vs Mes Pasado</div>
                   </div>
               </div>
               
               <div class="metric-card occupancy">
                   <div class="metric-icon">👥</div>
                   <div class="metric-content">
                       <div class="metric-number">${stats.tipos_cliente.total_personas || 0}</div>
                       <div class="metric-label">Personas Este Mes</div>
                   </div>
               </div>
           </div>
           
           <!-- Información Detallada -->
           <div class="detailed-stats">
               <!-- Top Días -->
               <div class="stat-section">
                   <h5>🏆 Mis Mejores Días Este Mes</h5>
                   <div class="top-days">
   `;

    if (stats.top_dias && stats.top_dias.length > 0) {
        stats.top_dias.forEach((dia, index) => {
            const fecha = new Date(dia.fecha).toLocaleDateString('es-ES', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit'
            });
            const medalla = ['🥇', '🥈', '🥉'][index] || '🏅';

            html += `
               <div class="top-day-item">
                   <span class="medal">${medalla}</span>
                   <span class="date">${fecha}</span>
                   <span class="count">${dia.total_reservas} reservas</span>
                   <span class="people">${dia.total_personas} personas</span>
               </div>
           `;
        });
    } else {
        html += '<p class="no-data">📊 No hay datos suficientes este mes</p>';
    }

    html += `
                   </div>
               </div>
               
               <!-- Distribución de Clientes -->
               <div class="stat-section">
                   <h5>👥 Mis Clientes Este Mes</h5>
                   <div class="client-distribution">
   `;

    if (stats.tipos_cliente) {
        const total = parseInt(stats.tipos_cliente.total_adultos || 0) +
            parseInt(stats.tipos_cliente.total_residentes || 0) +
            parseInt(stats.tipos_cliente.total_ninos || 0) +
            parseInt(stats.tipos_cliente.total_bebes || 0);

        if (total > 0) {
            html += `
               <div class="client-type">
                   <span class="type-icon">👨‍💼</span>
                   <span class="type-label">Adultos:</span>
                   <span class="type-count">${stats.tipos_cliente.total_adultos || 0}</span>
               </div>
               <div class="client-type">
                   <span class="type-icon">🏠</span>
                   <span class="type-label">Residentes:</span>
                   <span class="type-count">${stats.tipos_cliente.total_residentes || 0}</span>
               </div>
               <div class="client-type">
                   <span class="type-icon">👶</span>
                   <span class="type-label">Niños (5-12):</span>
                   <span class="type-count">${stats.tipos_cliente.total_ninos || 0}</span>
               </div>
               <div class="client-type">
                   <span class="type-icon">🍼</span>
                   <span class="type-label">Bebés (gratis):</span>
                   <span class="type-count">${stats.tipos_cliente.total_bebes || 0}</span>
               </div>
           `;
        } else {
            html += '<p class="no-data">📊 No hay reservas este mes</p>';
        }
    }

    html += `
                   </div>
               </div>
           </div>
           
           <!-- Botón de Actualizar -->
           <div class="stats-actions">
               <button class="btn-primary" onclick="loadAgencyQuickStats()">🔄 Actualizar Estadísticas</button>
           </div>
       </div>
   `;

    document.getElementById('agency-quick-stats-content').innerHTML = html;
}

/**
* Cerrar modal de estadísticas rápidas para agencia
*/
function closeAgencyQuickStatsModal() {
    document.getElementById('agencyQuickStatsModal').style.display = 'none';
}

// Exponer función globalmente
window.loadAgencyReservations = loadAgencyReservations;

/**
 * Funciones específicas para agencias - Detalles de reserva
 */
function showAgencyReservationDetails(reservaId) {
    console.log('Mostrando detalles de reserva de agencia:', reservaId);

    const formData = new FormData();
    formData.append('action', 'get_agency_reservation_details');
    formData.append('reserva_id', reservaId);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderAgencyReservationDetails(data.data);
                document.getElementById('agencyReservationDetailsModal').style.display = 'block';
            } else {
                alert('Error cargando detalles: ' + data.data);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error de conexión');
        });
}

/**
 * Renderizar detalles de reserva para agencia
 */
function renderAgencyReservationDetails(reserva) {
    const fechaServicio = new Date(reserva.fecha).toLocaleDateString('es-ES');
    const fechaCreacion = new Date(reserva.created_at).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    let fechaActualizacion = '';
    if (reserva.updated_at && reserva.updated_at !== reserva.created_at) {
        const fechaUpdate = new Date(reserva.updated_at).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        fechaActualizacion = `
            <p><strong>Última actualización:</strong> ${fechaUpdate}</p>
        `;
    }

    let descuentoInfo = '';
    if (reserva.regla_descuento_aplicada) {
        descuentoInfo = `
            <div class="detail-section">
                <h4>💰 Información de Descuento</h4>
                <p><strong>Regla aplicada:</strong> ${reserva.regla_descuento_aplicada.rule_name}</p>
                <p><strong>Porcentaje:</strong> ${reserva.regla_descuento_aplicada.discount_percentage}%</p>
                <p><strong>Mínimo personas:</strong> ${reserva.regla_descuento_aplicada.minimum_persons}</p>
            </div>
        `;
    }

    const detailsHtml = `
        <div class="reservation-details">
            <div class="details-grid">
                <div class="detail-section">
                    <h4>📋 Información General</h4>
                    <p><strong>Localizador:</strong> ${reserva.localizador}</p>
                    <p><strong>Estado:</strong> <span class="status-badge status-${reserva.estado}">${reserva.estado.toUpperCase()}</span></p>
                    <p><strong>Fecha de servicio:</strong> ${fechaServicio}</p>
                    <p><strong>Hora:</strong> ${reserva.hora}</p>
                    <p><strong>Fecha de compra:</strong> ${fechaCreacion}</p>
                    ${fechaActualizacion}
                </div>
                
                <div class="detail-section">
                    <h4>👤 Datos del Cliente</h4>
                    <p><strong>Nombre:</strong> ${reserva.nombre} ${reserva.apellidos}</p>
                    <p><strong>Email:</strong> ${reserva.email || 'No proporcionado'}</p>
                    <p><strong>Teléfono:</strong> ${reserva.telefono}</p>
                </div>
                
                <div class="detail-section">
                    <h4>👥 Distribución de Personas</h4>
                    <p><strong>Adultos:</strong> ${reserva.adultos}</p>
                    <p><strong>Residentes:</strong> ${reserva.residentes}</p>
                    <p><strong>Niños (5-12 años):</strong> ${reserva.ninos_5_12}</p>
                    <p><strong>Niños menores (gratis):</strong> ${reserva.ninos_menores}</p>
                    <p><strong>Total personas con plaza:</strong> ${reserva.total_personas}</p>
                </div>
                
                <div class="detail-section">
                    <h4>💰 Información de Precios</h4>
                    <p><strong>Precio base:</strong> ${parseFloat(reserva.precio_base).toFixed(2)}€</p>
                    <p><strong>Descuento total:</strong> ${parseFloat(reserva.descuento_total).toFixed(2)}€</p>
                    <p><strong>Precio final:</strong> <span class="price-final">${parseFloat(reserva.precio_final).toFixed(2)}€</span></p>
                    <p><strong>Método de pago:</strong> ${reserva.metodo_pago}</p>
                </div>
            </div>
            
            ${descuentoInfo}
        </div>
    `;

    document.getElementById('agencyReservationModalTitle').textContent = `Detalles de Reserva - ${reserva.localizador}`;
    document.getElementById('agency-reservation-details-content').innerHTML = detailsHtml;
}

/**
 * Descargar PDF de ticket para agencia
 */
function downloadAgencyTicketPDF(reservaId, localizador) {
    console.log('📄 Descargando PDF para agencia - reserva:', reservaId, localizador);

    if (!reservaId || !localizador) {
        alert('❌ Datos de reserva no válidos');
        return;
    }

    // Mostrar indicador de carga
    showPDFLoadingIndicator();

    const formData = new FormData();
    formData.append('action', 'generate_agency_ticket_pdf');
    formData.append('reserva_id', reservaId);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            hidePDFLoadingIndicator();

            if (data.success && data.data.pdf_url) {
                console.log('✅ PDF generado exitosamente para agencia');

                // Descargar automáticamente
                const link = document.createElement('a');
                link.href = data.data.pdf_url;
                link.download = data.data.filename || `billete_${localizador}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Mostrar mensaje de éxito
                showTemporaryNotification('✅ PDF descargado correctamente', 'success', 3000);
            } else {
                console.error('❌ Error generando PDF:', data.data);
                alert('❌ Error generando el PDF: ' + (data.data || 'Error desconocido'));
            }
        })
        .catch(error => {
            hidePDFLoadingIndicator();
            console.error('❌ Error de conexión:', error);
            alert('❌ Error de conexión al generar el PDF');
        });
}

/**
 * Cancelar reserva para agencia con validación de horas
 */
function showAgencyCancelReservationModal(reservaId, localizador) {
    // Primero verificar si se puede cancelar
    const formData = new FormData();
    formData.append('action', 'check_agency_cancellation_allowed');
    formData.append('reserva_id', reservaId);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (data.data.can_cancel) {
                    // Mostrar modal de cancelación directa
                    showDirectCancellationModal(reservaId, localizador, data.data.hours_remaining);
                } else {
                    // Mostrar mensaje de que no se puede cancelar
                    alert(`❌ No se puede cancelar esta reserva.\n\n${data.data.message}\n\nTiempo límite: ${data.data.hours_limit} horas antes del servicio.`);
                }
            } else {
                alert('❌ Error verificando permisos de cancelación: ' + data.data);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('❌ Error de conexión verificando permisos');
        });
}

/**
 * Mostrar modal de cancelación directa
 */
function showDirectCancellationModal(reservaId, localizador, hoursRemaining) {
    // Crear modal si no existe
    if (!document.getElementById('agencyDirectCancelModal')) {
        const modalHtml = `
            <div id="agencyDirectCancelModal" class="modal" style="display: none;">
                <div class="modal-content" style="max-width: 500px;">
                    <span class="close" onclick="closeAgencyDirectCancelModal()">&times;</span>
                    <h3 style="color: #dc3545;">⚠️ Cancelar Reserva</h3>
                    <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #28a745;">
                        <p style="margin: 0; color: #155724; font-weight: bold;">
                            ✅ Puedes cancelar la reserva <strong id="direct-cancel-localizador"></strong>
                        </p>
                        <p style="margin: 5px 0 0 0; color: #155724; font-size: 14px;">
                            Tiempo restante para cancelar: <strong id="direct-cancel-hours"></strong> horas
                        </p>
                    </div>
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ffc107;">
                        <p style="margin: 0; color: #856404; font-weight: bold;">
                            ⚠️ Esta acción NO se puede deshacer
                        </p>
                        <p style="margin: 5px 0 0 0; color: #856404; font-size: 14px;">
                            Las plazas se liberarán automáticamente y se enviará notificación al cliente.
                        </p>
                    </div>
                    <form id="agencyDirectCancelForm">
                        <input type="hidden" id="direct-cancel-reserva-id">
                        <div class="form-group">
                            <label for="direct-motivo-cancelacion" style="font-weight: bold; color: #495057;">
                                Motivo de cancelación (opcional):
                            </label>
                            <textarea id="direct-motivo-cancelacion" name="motivo_cancelacion" 
                                      rows="3" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;" 
                                      placeholder="Ej: Cancelación por parte del cliente, problemas técnicos, etc."></textarea>
                        </div>
                        <div class="form-actions" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                            <button type="button" class="btn-secondary" onclick="closeAgencyDirectCancelModal()">
                                Cancelar
                            </button>
                            <button type="submit" class="btn-danger" style="background: #dc3545; color: white;">
                                ❌ Confirmar Cancelación
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Añadir evento al formulario
        document.getElementById('agencyDirectCancelForm').addEventListener('submit', function (e) {
            e.preventDefault();
            processAgencyDirectCancellation();
        });
    }

    // Configurar modal
    document.getElementById('direct-cancel-reserva-id').value = reservaId;
    document.getElementById('direct-cancel-localizador').textContent = localizador;
    document.getElementById('direct-cancel-hours').textContent = Math.floor(hoursRemaining);
    document.getElementById('direct-motivo-cancelacion').value = '';
    document.getElementById('agencyDirectCancelModal').style.display = 'block';
}


/**
 * Cerrar modal de cancelación directa
 */
function closeAgencyDirectCancelModal() {
    document.getElementById('agencyDirectCancelModal').style.display = 'none';
}

/**
 * Procesar cancelación directa de agencia
 */
function processAgencyDirectCancellation() {
    const reservaId = document.getElementById('direct-cancel-reserva-id').value;
    const motivo = document.getElementById('direct-motivo-cancelacion').value.trim() || 'Cancelación por agencia';

    if (!confirm('¿Estás COMPLETAMENTE SEGURO de cancelar esta reserva?\n\n⚠️ ESTA ACCIÓN NO SE PUEDE DESHACER ⚠️\n\nSe enviará notificación al cliente automáticamente.')) {
        return;
    }

    // Deshabilitar botón
    const submitBtn = document.querySelector('#agencyDirectCancelForm button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Cancelando...';

    const formData = new FormData();
    formData.append('action', 'process_agency_direct_cancellation');
    formData.append('reserva_id', reservaId);
    formData.append('motivo_cancelacion', motivo);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            // Rehabilitar botón
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;

            if (data.success) {
                alert('✅ ' + data.data);
                closeAgencyDirectCancelModal();

                // Recargar la lista de reservas
                loadAgencyReservationsByDateWithFilters();
            } else {
                alert('❌ Error: ' + data.data);
            }
        })
        .catch(error => {
            // Rehabilitar botón
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;

            console.error('Error:', error);
            alert('❌ Error de conexión al cancelar la reserva');
        });
}

// Exponer funciones globalmente
window.showAgencyCancelReservationModal = showAgencyCancelReservationModal;
window.closeAgencyDirectCancelModal = closeAgencyDirectCancelModal;

/**
 * Cerrar modal de cancelación de agencia
 */
function closeAgencyCancelReservationModal() {
    document.getElementById('agencyCancelReservationModal').style.display = 'none';
}

/**
 * Procesar solicitud de cancelación de agencia
 */
function processAgencyCancelRequest() {
    const reservaId = document.getElementById('agency-cancel-reserva-id').value;
    const motivo = document.getElementById('agency-motivo-cancelacion').value.trim();

    if (!motivo) {
        alert('Por favor, especifica el motivo de la solicitud de cancelación.');
        return;
    }

    if (!confirm('¿Estás seguro de enviar esta solicitud de cancelación al administrador?')) {
        return;
    }

    // Deshabilitar botón
    const submitBtn = document.querySelector('#agencyCancelReservationForm button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Enviando...';

    const formData = new FormData();
    formData.append('action', 'request_agency_cancellation');
    formData.append('reserva_id', reservaId);
    formData.append('motivo_cancelacion', motivo);
    formData.append('nonce', reservasAjax.nonce);

    fetch(reservasAjax.ajax_url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            // Rehabilitar botón
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;

            if (data.success) {
                alert('✅ ' + data.data);
                closeAgencyCancelReservationModal();

                // Recargar la lista de reservas
                loadAgencyReservationsByDateWithFilters();
            } else {
                alert('❌ Error: ' + data.data);
            }
        })
        .catch(error => {
            // Rehabilitar botón
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;

            console.error('Error:', error);
            alert('❌ Error de conexión al enviar la solicitud');
        });
}

/**
 * Cerrar modal de detalles de reserva de agencia
 */
function closeAgencyReservationDetailsModal() {
    document.getElementById('agencyReservationDetailsModal').style.display = 'none';
}

// Exponer funciones globalmente
window.showAgencyReservationDetails = showAgencyReservationDetails;
window.downloadAgencyTicketPDF = downloadAgencyTicketPDF;
window.showAgencyCancelReservationModal = showAgencyCancelReservationModal;
window.closeAgencyCancelReservationModal = closeAgencyCancelReservationModal;
window.closeAgencyReservationDetailsModal = closeAgencyReservationDetailsModal;

/**
 * Función de enlace para cargar el calendario del conductor
 * Esta función verifica si el archivo específico del conductor está cargado
 */
function loadConductorCalendarSection() {
    console.log('=== INICIANDO CALENDARIO CONDUCTOR ===');

    // Verificar si las funciones del conductor están disponibles
    if (typeof conductorCurrentDate !== 'undefined') {
        // El archivo conductor-dashboard-script.js ya está cargado
        console.log('✅ Archivo conductor-dashboard-script.js detectado');
        // La función ya está definida en el archivo específico del conductor
        return;
    } else {
        console.log('❌ Archivo conductor-dashboard-script.js no cargado, iniciando manualmente...');

        // Fallback: cargar manualmente si el archivo no se cargó
        initConductorFallback();
    }
}

/**
 * Función de respaldo si el archivo del conductor no se carga
 */
function initConductorFallback() {
    alert('El sistema del conductor no se ha cargado correctamente. Por favor, recarga la página.');
    console.error('El archivo conductor-dashboard-script.js no se cargó correctamente');
}