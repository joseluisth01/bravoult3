<?php

/**
 * Clase ReservasCalendarAdmin actualizada para sincronizar con configuración
 * Archivo: wp-content/plugins/sistema-reservas/includes/class-calendar-admin.php
 */
class ReservasCalendarAdmin
{

    public function __construct()
    {
        // ✅ HOOKS CON SOPORTE PARA USUARIOS NO LOGUEADOS
        add_action('wp_ajax_get_calendar_data', array($this, 'get_calendar_data'));
        add_action('wp_ajax_nopriv_get_calendar_data', array($this, 'get_calendar_data'));

        add_action('wp_ajax_save_service', array($this, 'save_service'));
        add_action('wp_ajax_nopriv_save_service', array($this, 'save_service'));

        add_action('wp_ajax_delete_service', array($this, 'delete_service'));
        add_action('wp_ajax_nopriv_delete_service', array($this, 'delete_service'));

        add_action('wp_ajax_get_service_details', array($this, 'get_service_details'));
        add_action('wp_ajax_nopriv_get_service_details', array($this, 'get_service_details'));

        add_action('wp_ajax_bulk_add_services', array($this, 'bulk_add_services'));
        add_action('wp_ajax_nopriv_bulk_add_services', array($this, 'bulk_add_services'));
    }

    public function get_calendar_data()
    {

        error_log('=== CALENDAR AJAX REQUEST START ===');
        error_log('POST data: ' . print_r($_POST, true));

        // ✅ NO USAR ob_clean() QUE PUEDE CAUSAR PROBLEMAS
        header('Content-Type: application/json');

        try {


            if (!session_id()) {
                session_start();
            }

            error_log('Session data: ' . print_r($_SESSION ?? [], true));

            if (!isset($_SESSION['reservas_user'])) {
                error_log('❌ No hay usuario en sesión');
                wp_send_json_error('Sesión expirada. Recarga la página e inicia sesión nuevamente.');
                return;
            }

            $user = $_SESSION['reservas_user'];
            if (!in_array($user['role'], ['super_admin', 'admin'])) {
                error_log('❌ Usuario sin permisos: ' . $user['role']);
                wp_send_json_error('Sin permisos');
                return;
            }

            error_log('✅ Usuario validado: ' . $user['username']);

            // ✅ OBTENER DATOS DEL CALENDARIO
            global $wpdb;
            $table_name = $wpdb->prefix . 'reservas_servicios';

            $month = isset($_POST['month']) ? intval($_POST['month']) : date('n');
            $year = isset($_POST['year']) ? intval($_POST['year']) : date('Y');

            error_log("Loading calendar for: $month/$year");

            $first_day = sprintf('%04d-%02d-01', $year, $month);
            $last_day = date('Y-m-t', strtotime($first_day));

            $servicios = $wpdb->get_results($wpdb->prepare(
                "SELECT id, fecha, hora, plazas_totales, plazas_disponibles, 
                precio_adulto, precio_nino, precio_residente,
                tiene_descuento, porcentaje_descuento, enabled
        FROM $table_name 
        WHERE fecha BETWEEN %s AND %s 
        AND status = 'active'
        ORDER BY fecha, hora",
                $first_day,
                $last_day
            ));

            if ($wpdb->last_error) {
                error_log('❌ Database error: ' . $wpdb->last_error);
                die(json_encode(['success' => false, 'data' => 'Database error: ' . $wpdb->last_error]));
            }

            error_log('✅ Found ' . count($servicios) . ' services');

            // Organizar por fecha
            $calendar_data = array();
            foreach ($servicios as $servicio) {
                if (!isset($calendar_data[$servicio->fecha])) {
                    $calendar_data[$servicio->fecha] = array();
                }

                $calendar_data[$servicio->fecha][] = array(
                    'id' => $servicio->id,
                    'hora' => substr($servicio->hora, 0, 5),
                    'plazas_totales' => $servicio->plazas_totales,
                    'plazas_disponibles' => $servicio->plazas_disponibles,
                    'precio_adulto' => $servicio->precio_adulto,
                    'precio_nino' => $servicio->precio_nino,
                    'precio_residente' => $servicio->precio_residente,
                    'tiene_descuento' => $servicio->tiene_descuento,
                    'porcentaje_descuento' => $servicio->porcentaje_descuento,
                    'enabled' => $servicio->enabled  // ✅ AÑADIR ESTE CAMPO
                );
            }

            error_log('✅ Calendar data prepared successfully');
            die(json_encode(['success' => true, 'data' => $calendar_data]));
        } catch (Exception $e) {
            error_log('❌ CALENDAR EXCEPTION: ' . $e->getMessage());
            die(json_encode(['success' => false, 'data' => 'Server error: ' . $e->getMessage()]));
        }
    }

    public function save_service()
    {
        if (!session_id()) {
            session_start();
        }

        if (!isset($_SESSION['reservas_user'])) {
            wp_send_json_error('Sesión expirada. Recarga la página e inicia sesión nuevamente.');
            return;
        }

        $user = $_SESSION['reservas_user'];
        if (!in_array($user['role'], ['super_admin', 'admin'])) {
            wp_send_json_error('Sin permisos');
            return;
        }

        global $wpdb;
        $table_name = $wpdb->prefix . 'reservas_servicios';

        $fecha = sanitize_text_field($_POST['fecha']);
        $hora = sanitize_text_field($_POST['hora']);
        $hora_vuelta = sanitize_text_field($_POST['hora_vuelta']);
        $plazas_totales = intval($_POST['plazas_totales']);
        $precio_adulto = floatval($_POST['precio_adulto']);
        $precio_nino = floatval($_POST['precio_nino']);
        $precio_residente = floatval($_POST['precio_residente']);
        $service_id = isset($_POST['service_id']) ? intval($_POST['service_id']) : 0;

        // ✅ NUEVO CAMPO: ENABLED
        $enabled = isset($_POST['enabled']) ? 1 : 0;

        // Campos de descuento
        $tiene_descuento = isset($_POST['tiene_descuento']) ? 1 : 0;
        $porcentaje_descuento = floatval($_POST['porcentaje_descuento']) ?: 0;
        $descuento_tipo = sanitize_text_field($_POST['descuento_tipo'] ?? 'fijo');
        $descuento_minimo_personas = intval($_POST['descuento_minimo_personas'] ?? 1);
        $descuento_acumulable = isset($_POST['descuento_acumulable']) ? 1 : 0;
        $descuento_prioridad = sanitize_text_field($_POST['descuento_prioridad'] ?? 'servicio');

        if (!class_exists('ReservasConfigurationAdmin')) {
            require_once RESERVAS_PLUGIN_PATH . 'includes/class-configuration-admin.php';
        }

        $dias_anticipacion = ReservasConfigurationAdmin::get_dias_anticipacion_minima();
    
    // ✅ CORREGIR CÁLCULO DE FECHA MÍNIMA
    $fecha_minima = date('Y-m-d');
    if ($dias_anticipacion > 0) {
        $fecha_minima = date('Y-m-d', strtotime("+$dias_anticipacion days"));
    }

    // ✅ CAMBIO AQUÍ: Solo validar si NO es super_admin
    if ($user['role'] !== 'super_admin') {
        if ($fecha < $fecha_minima) {
            wp_send_json_error("No se pueden crear servicios para fechas anteriores a $fecha_minima (mínimo $dias_anticipacion días de anticipación)");
            return;
        }
    }

        if (!in_array($descuento_tipo, ['fijo', 'por_grupo'])) {
            $descuento_tipo = 'fijo';
        }

        if (!in_array($descuento_prioridad, ['servicio', 'grupo'])) {
            $descuento_prioridad = 'servicio';
        }

        if ($descuento_tipo === 'fijo') {
            $descuento_minimo_personas = 1;
        }



        $data = array(
            'fecha' => $fecha,
            'hora' => $hora,
            'hora_vuelta' => $hora_vuelta,
            'plazas_totales' => $plazas_totales,
            'plazas_disponibles' => $plazas_totales,
            'precio_adulto' => $precio_adulto,
            'precio_nino' => $precio_nino,
            'precio_residente' => $precio_residente,
            'tiene_descuento' => $tiene_descuento,
            'porcentaje_descuento' => $porcentaje_descuento,
            'descuento_tipo' => $descuento_tipo,
            'descuento_minimo_personas' => $descuento_minimo_personas,
            'descuento_acumulable' => $descuento_acumulable,
            'descuento_prioridad' => $descuento_prioridad,
            'enabled' => $enabled, // ✅ NUEVO CAMPO
            'status' => 'active'
        );

        if ($service_id > 0) {
            // Actualizar
            $result = $wpdb->update($table_name, $data, array('id' => $service_id));
        } else {
            // Insertar
            $result = $wpdb->insert($table_name, $data);
        }

        if ($result !== false) {
            wp_send_json_success('Servicio guardado correctamente');
        } else {
            wp_send_json_error('Error al guardar el servicio: ' . $wpdb->last_error);
        }
    }

    public function delete_service()
    {
        if (!session_id()) {
            session_start();
        }

        if (!isset($_SESSION['reservas_user'])) {
            wp_send_json_error('Sesión expirada. Recarga la página e inicia sesión nuevamente.');
            return;
        }

        $user = $_SESSION['reservas_user'];
        if (!in_array($user['role'], ['super_admin', 'admin'])) {
            wp_send_json_error('Sin permisos');
            return;
        }

        global $wpdb;
        $table_name = $wpdb->prefix . 'reservas_servicios';

        $service_id = intval($_POST['service_id']);

        $result = $wpdb->delete($table_name, array('id' => $service_id));

        if ($result !== false) {
            wp_send_json_success('Servicio eliminado correctamente');
        } else {
            wp_send_json_error('Error al eliminar el servicio');
        }
    }

    public function get_service_details()
    {
        if (!session_id()) {
            session_start();
        }

        if (!isset($_SESSION['reservas_user'])) {
            wp_send_json_error('Sesión expirada. Recarga la página e inicia sesión nuevamente.');
            return;
        }

        $user = $_SESSION['reservas_user'];
        if (!in_array($user['role'], ['super_admin', 'admin'])) {
            wp_send_json_error('Sin permisos');
            return;
        }

        global $wpdb;
        $table_name = $wpdb->prefix . 'reservas_servicios';

        $service_id = intval($_POST['service_id']);

        $servicio = $wpdb->get_row($wpdb->prepare(
            "SELECT *, hora_vuelta, descuento_tipo, descuento_minimo_personas, 
                descuento_acumulable, descuento_prioridad, enabled
         FROM $table_name WHERE id = %d",
            $service_id
        ));

        if ($servicio) {
            wp_send_json_success($servicio);
        } else {
            wp_send_json_error('Servicio no encontrado');
        }
    }

    public function bulk_add_services()
    {
        if (!session_id()) {
            session_start();
        }

        if (!isset($_SESSION['reservas_user'])) {
            wp_send_json_error('Sesión expirada. Recarga la página e inicia sesión nuevamente.');
            return;
        }

        $user = $_SESSION['reservas_user'];
        if (!in_array($user['role'], ['super_admin', 'admin'])) {
            wp_send_json_error('Sin permisos');
            return;
        }

        global $wpdb;
        $table_name = $wpdb->prefix . 'reservas_servicios';

        $fecha_inicio = sanitize_text_field($_POST['fecha_inicio']);
        $fecha_fin = sanitize_text_field($_POST['fecha_fin']);
        $horarios = json_decode(stripslashes($_POST['horarios']), true);
        $horarios_vuelta = json_decode(stripslashes($_POST['horarios_vuelta']), true);
        $plazas_totales = intval($_POST['plazas_totales']);
        $precio_adulto = floatval($_POST['precio_adulto']);
        $precio_nino = floatval($_POST['precio_nino']);
        $precio_residente = floatval($_POST['precio_residente']);
        $dias_semana = isset($_POST['dias_semana']) ? $_POST['dias_semana'] : array();

        // ✅ NUEVO CAMPO PARA BULK
        $enabled = isset($_POST['bulk_enabled']) ? 1 : 0;

        // Campos de descuento para bulk
        $tiene_descuento = isset($_POST['bulk_tiene_descuento']) ? 1 : 0;
        $porcentaje_descuento = floatval($_POST['bulk_porcentaje_descuento']) ?: 0;
        $descuento_tipo = sanitize_text_field($_POST['bulk_descuento_tipo'] ?? 'fijo');
        $descuento_minimo_personas = intval($_POST['bulk_descuento_minimo_personas'] ?? 1);
        $descuento_acumulable = isset($_POST['bulk_descuento_acumulable']) ? 1 : 0;
        $descuento_prioridad = sanitize_text_field($_POST['bulk_descuento_prioridad'] ?? 'servicio');

        // Validar días de anticipación mínima para bulk
        if (!class_exists('ReservasConfigurationAdmin')) {
            require_once RESERVAS_PLUGIN_PATH . 'includes/class-configuration-admin.php';
        }

        if (!in_array($descuento_tipo, ['fijo', 'por_grupo'])) {
            $descuento_tipo = 'fijo';
        }

        if ($descuento_tipo === 'fijo') {
            $descuento_minimo_personas = 1;
        }

        $dias_anticipacion = ReservasConfigurationAdmin::get_dias_anticipacion_minima();
        $fecha_minima = date('Y-m-d', strtotime("+$dias_anticipacion days"));

        if ($fecha_inicio < $fecha_minima) {
            wp_send_json_error("La fecha de inicio no puede ser anterior a $fecha_minima (mínimo $dias_anticipacion días de anticipación)");
        }

        if (count($horarios) !== count($horarios_vuelta)) {
            wp_send_json_error('Debe haber el mismo número de horarios de ida y vuelta');
            return;
        }

        $fecha_actual = strtotime($fecha_inicio);
        $fecha_limite = strtotime($fecha_fin);
        $servicios_creados = 0;
        $servicios_existentes = 0;
        $servicios_bloqueados = 0;
        $errores = 0;

        while ($fecha_actual <= $fecha_limite) {
            $fecha_str = date('Y-m-d', $fecha_actual);
            $dia_semana = date('w', $fecha_actual);

            if ($fecha_str < $fecha_minima && $user['role'] !== 'super_admin') {
                $servicios_bloqueados++;
                $fecha_actual = strtotime('+1 day', $fecha_actual);
                continue;
            }

            if (empty($dias_semana) || in_array($dia_semana, $dias_semana)) {
                for ($i = 0; $i < count($horarios); $i++) {
                    $hora = sanitize_text_field($horarios[$i]['hora']);
                    $hora_vuelta = sanitize_text_field($horarios_vuelta[$i]['hora']);

                    if ($user['role'] === 'super_admin') {
                        // Super admin siempre puede crear servicios
                        $can_create = true;
                    } else {
                        // Otros roles verifican si no existe
                        $existing = $wpdb->get_var($wpdb->prepare(
                            "SELECT COUNT(*) FROM $table_name WHERE fecha = %s AND hora = %s",
                            $fecha_str,
                            $hora
                        ));
                        $can_create = ($existing == 0);
                    }

                    if ($can_create) {
                        $result = $wpdb->insert($table_name, array(
                            'fecha' => $fecha_str,
                            'hora' => $hora,
                            'hora_vuelta' => $hora_vuelta,
                            'plazas_totales' => $plazas_totales,
                            'plazas_disponibles' => $plazas_totales,
                            'precio_adulto' => $precio_adulto,
                            'precio_nino' => $precio_nino,
                            'precio_residente' => $precio_residente,
                            'tiene_descuento' => $tiene_descuento,
                            'porcentaje_descuento' => $porcentaje_descuento,
                            'descuento_tipo' => $descuento_tipo,
                            'descuento_minimo_personas' => $descuento_minimo_personas,
                            'descuento_acumulable' => $descuento_acumulable,
                            'descuento_prioridad' => $descuento_prioridad,
                            'enabled' => $enabled, // ✅ NUEVO CAMPO
                            'status' => 'active'
                        ));

                        if ($result !== false) {
                            $servicios_creados++;
                        } else {
                            $errores++;
                            error_log("Error insertando servicio: " . $wpdb->last_error);
                        }
                    } else {
                        $servicios_existentes++;
                    }
                }
            }

            $fecha_actual = strtotime('+1 day', $fecha_actual);
        }

        $mensaje = "Se crearon $servicios_creados servicios.";
        if ($servicios_existentes > 0) {
            $mensaje .= " $servicios_existentes ya existían.";
        }
        if ($servicios_bloqueados > 0) {
            $mensaje .= " $servicios_bloqueados fueron bloqueados por días de anticipación.";
        }
        if ($errores > 0) {
            $mensaje .= " Hubo $errores errores.";
        }

        wp_send_json_success(array(
            'creados' => $servicios_creados,
            'existentes' => $servicios_existentes,
            'bloqueados' => $servicios_bloqueados,
            'errores' => $errores,
            'mensaje' => $mensaje
        ));
    }
}
