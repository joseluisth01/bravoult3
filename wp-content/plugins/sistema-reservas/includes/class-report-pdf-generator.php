<?php

/**
 * Generador de PDF para informes de reservas - NUEVO
 * Archivo: wp-content/plugins/sistema-reservas/includes/class-report-pdf-generator.php
 */

require_once RESERVAS_PLUGIN_PATH . 'vendor/tecnickcom/tcpdf/tcpdf.php';

class ReservasReportPDFGenerator
{
    private $pdf;

    public function __construct()
    {
        // Configuración básica del PDF
        $this->pdf = new TCPDF('P', 'mm', 'A4', true, 'UTF-8', false);
        $this->setup_pdf();
    }

    private function setup_pdf()
    {
        // Configuración del documento
        $this->pdf->SetCreator('Sistema de Reservas');
        $this->pdf->SetAuthor('Autocares Bravo');
        $this->pdf->SetTitle('Listado de Reservas');

        // Configuración de página
        $this->pdf->SetMargins(10, 15, 10);
        $this->pdf->SetHeaderMargin(10);
        $this->pdf->SetFooterMargin(10);
        $this->pdf->SetAutoPageBreak(TRUE, 15);

        // Fuente por defecto
        $this->pdf->SetFont('helvetica', '', 9);
    }

    public function generate_report_pdf($filtros)
    {
        try {
            // Obtener datos para el informe
            $data = $this->get_report_data($filtros);

            if (empty($data['reservas_agrupadas'])) {
                throw new Exception('No se encontraron reservas para el período seleccionado');
            }

            // Generar PDF
            $this->pdf->AddPage();
            $this->add_header($filtros);
            $this->add_reservas_content($data);
            $this->add_totales_agencias($data);

            // Guardar archivo
            $upload_dir = wp_upload_dir();
            $filename = 'informe_reservas_' . time() . '_' . wp_generate_password(8, false) . '.pdf';
            $pdf_path = $upload_dir['path'] . '/' . $filename;

            $this->pdf->Output($pdf_path, 'F');

            return $pdf_path;
        } catch (Exception $e) {
            error_log('Error en generación de PDF: ' . $e->getMessage());
            throw $e;
        }
    }

private function get_report_data($filtros)
{
    global $wpdb;
    $table_reservas = $wpdb->prefix . 'reservas_reservas';
    $table_agencies = $wpdb->prefix . 'reservas_agencies';
    $table_servicios = $wpdb->prefix . 'reservas_servicios';

    // Construir condiciones WHERE
    $where_conditions = array();
    $query_params = array();

    // Filtro por tipo de fecha
    if ($filtros['tipo_fecha'] === 'compra') {
        $where_conditions[] = "DATE(r.created_at) BETWEEN %s AND %s";
    } else {
        $where_conditions[] = "r.fecha BETWEEN %s AND %s";
    }
    $query_params[] = $filtros['fecha_inicio'];
    $query_params[] = $filtros['fecha_fin'];

    // Filtro de estado
    switch ($filtros['estado_filtro']) {
        case 'confirmadas':
            $where_conditions[] = "r.estado = 'confirmada'";
            break;
        case 'canceladas':
            $where_conditions[] = "r.estado = 'cancelada'";
            break;
        case 'todas':
            // No añadir condición
            break;
    }

    // Filtro por agencias
    switch ($filtros['agency_filter']) {
        case 'sin_agencia':
            $where_conditions[] = "r.agency_id IS NULL";
            break;
        case 'todas':
            // No añadir condición
            break;
        default:
            if (is_numeric($filtros['agency_filter']) && $filtros['agency_filter'] > 0) {
                $where_conditions[] = "r.agency_id = %d";
                $query_params[] = intval($filtros['agency_filter']);
            }
            break;
    }

    // ✅ NUEVO: Filtro por horarios seleccionados - CORREGIDO
    if (!empty($filtros['selected_schedules'])) {
        $selected_schedules = json_decode($filtros['selected_schedules'], true);
        
        if (is_array($selected_schedules) && !empty($selected_schedules)) {
            $schedule_conditions = array();
            
            foreach ($selected_schedules as $schedule) {
                if (!empty($schedule['hora'])) {
                    // ✅ CORREGIR: Usar TIME() para comparar solo la parte de hora
                    if (!empty($schedule['hora_vuelta']) && $schedule['hora_vuelta'] !== 'null' && $schedule['hora_vuelta'] !== '00:00:00') {
                        // Filtrar por hora de ida Y vuelta específicas
                        $schedule_conditions[] = "(TIME(s.hora) = TIME(%s) AND TIME(s.hora_vuelta) = TIME(%s))";
                        $query_params[] = $schedule['hora'];
                        $query_params[] = $schedule['hora_vuelta'];
                    } else {
                        // Filtrar solo por hora de ida
                        $schedule_conditions[] = "(TIME(s.hora) = TIME(%s) AND (s.hora_vuelta IS NULL OR s.hora_vuelta = '' OR TIME(s.hora_vuelta) = '00:00:00'))";
                        $query_params[] = $schedule['hora'];
                    }
                }
            }
            
            if (!empty($schedule_conditions)) {
                $where_conditions[] = '(' . implode(' OR ', $schedule_conditions) . ')';
            }
        }
    }

    $where_clause = 'WHERE ' . implode(' AND ', $where_conditions);

    // ✅ AÑADIR LOG PARA DEBUG
    error_log('=== PDF QUERY DEBUG ===');
    error_log('Selected schedules: ' . ($filtros['selected_schedules'] ?? 'No schedules'));
    error_log('Where clause: ' . $where_clause);
    error_log('Query params: ' . print_r($query_params, true));

    // Query principal
    $query = "SELECT r.*, 
                     s.hora as servicio_hora, 
                     s.hora_vuelta as servicio_hora_vuelta,
                     COALESCE(a.agency_name, 'Web') as origen_reserva,
                     a.inicial_localizador as inicial_agencia
             FROM $table_reservas r
             INNER JOIN $table_servicios s ON r.servicio_id = s.id
             LEFT JOIN $table_agencies a ON r.agency_id = a.id
             $where_clause
             ORDER BY r.fecha ASC, s.hora ASC, r.agency_id ASC";

    $reservas = $wpdb->get_results($wpdb->prepare($query, ...$query_params));

    // ✅ AÑADIR LOG PARA VERIFICAR RESULTADOS
    error_log('Total reservas encontradas: ' . count($reservas));
    if (!empty($reservas)) {
        error_log('Primera reserva - Hora: ' . $reservas[0]->servicio_hora . ', Fecha: ' . $reservas[0]->fecha);
        error_log('Última reserva - Hora: ' . end($reservas)->servicio_hora . ', Fecha: ' . end($reservas)->fecha);
    }

    // Agrupar datos
    $reservas_agrupadas = $this->group_reservations($reservas);
    $totales_agencias = $this->calculate_agency_totals($reservas);

    return array(
        'reservas_agrupadas' => $reservas_agrupadas,
        'totales_agencias' => $totales_agencias,
        'filtros' => $filtros
    );
}

    private function group_reservations($reservas)
    {
        $grouped = array();

        foreach ($reservas as $reserva) {
            $fecha = $reserva->fecha;
            $turno = $this->get_turno_name($reserva->servicio_hora, $reserva->servicio_hora_vuelta);
            $origen = $this->get_origen_name($reserva);

            // Inicializar estructura si no existe
            if (!isset($grouped[$fecha])) {
                $grouped[$fecha] = array();
            }

            if (!isset($grouped[$fecha][$turno])) {
                $grouped[$fecha][$turno] = array();
            }

            if (!isset($grouped[$fecha][$turno][$origen])) {
                $grouped[$fecha][$turno][$origen] = array(
                    'reservas' => array(),
                    'totales' => array(
                        'adultos' => 0,
                        'ninos' => 0,
                        'residentes' => 0,
                        'ninos_residentes' => 0,
                        'descuentos' => 0,
                        'importe' => 0
                    )
                );
            }

            // Añadir reserva
            $grouped[$fecha][$turno][$origen]['reservas'][] = $reserva;

            // Sumar totales
            $totales = &$grouped[$fecha][$turno][$origen]['totales'];
            $totales['adultos'] += $reserva->adultos;
            $totales['ninos'] += $reserva->ninos_5_12 + $reserva->ninos_menores;
            $totales['residentes'] += $reserva->residentes;
            $totales['ninos_residentes'] += 0; // Asumo que no hay campo separado
            $totales['descuentos'] += $reserva->descuento_total;
            $totales['importe'] += $reserva->precio_final;
        }

        return $grouped;
    }

private function get_turno_name($hora, $hora_vuelta)
{
    // ✅ ASEGURAR QUE SOLO TOMAMOS LA PARTE DE HORA (HH:MM)
    $hora_formato = date('H:i', strtotime($hora));

    if ($hora_vuelta && $hora_vuelta !== '00:00:00' && !empty($hora_vuelta)) {
        $vuelta_formato = date('H:i', strtotime($hora_vuelta));
        return "Turno de $hora_formato a $vuelta_formato";
    } else {
        return "Turno de $hora_formato";
    }
}

    private function get_origen_name($reserva)
    {
        if ($reserva->agency_id && !empty($reserva->origen_reserva) && $reserva->origen_reserva !== 'Web') {
            // ✅ USAR LA INICIAL_LOCALIZADOR SI ESTÁ DISPONIBLE
            if (!empty($reserva->inicial_agencia)) {
                return $reserva->origen_reserva . ' (' . $reserva->inicial_agencia . ')';
            }
            return $reserva->origen_reserva;
        } else {
            return 'Web';
        }
    }

    private function calculate_agency_totals($reservas)
    {
        $totales = array();

        foreach ($reservas as $reserva) {
            $origen = $this->get_origen_name($reserva);

            if (!isset($totales[$origen])) {
                $totales[$origen] = array(
                    'adultos' => 0,
                    'ninos' => 0,
                    'residentes' => 0,
                    'ninos_residentes' => 0,
                    'descuentos' => 0,
                    'importe' => 0,
                    'count' => 0
                );
            }

            $totales[$origen]['adultos'] += $reserva->adultos;
            $totales[$origen]['ninos'] += $reserva->ninos_5_12 + $reserva->ninos_menores;
            $totales[$origen]['residentes'] += $reserva->residentes;
            $totales[$origen]['ninos_residentes'] += 0;
            $totales[$origen]['descuentos'] += $reserva->descuento_total;
            $totales[$origen]['importe'] += $reserva->precio_final;
            $totales[$origen]['count'] += 1;
        }

        return $totales;
    }

    private function add_header($filtros)
{
    // Título principal
    $this->pdf->SetFont('helvetica', 'B', 16);
    $this->pdf->Cell(0, 10, 'Listado de Reservas', 0, 1, 'C');
    $this->pdf->Ln(5);

    // Período
    $fecha_inicio_formateada = date('d/m/Y', strtotime($filtros['fecha_inicio']));
    $fecha_fin_formateada = date('d/m/Y', strtotime($filtros['fecha_fin']));

    $this->pdf->SetFont('helvetica', '', 12);
    $this->pdf->Cell(0, 8, "Período: $fecha_inicio_formateada - $fecha_fin_formateada", 0, 1, 'C');

    // Filtros aplicados
    $this->pdf->SetFont('helvetica', '', 10);
    $filtros_texto = array();
    $filtros_texto[] = "Tipo fecha: " . ($filtros['tipo_fecha'] === 'compra' ? 'Compra' : 'Servicio');
    $filtros_texto[] = "Estado: " . ucfirst($filtros['estado_filtro']);
    
    if ($filtros['agency_filter'] !== 'todas') {
        $filtros_texto[] = "Agencia: " . $filtros['agency_filter'];
    }

    // ✅ MOSTRAR HORARIOS FILTRADOS
    if (!empty($filtros['selected_schedules'])) {
        $selected_schedules = json_decode($filtros['selected_schedules'], true);
        if (is_array($selected_schedules) && !empty($selected_schedules)) {
            $horarios_texto = array();
            foreach ($selected_schedules as $schedule) {
                if (!empty($schedule['hora'])) {
                    $hora_formato = date('H:i', strtotime($schedule['hora']));
                    if (!empty($schedule['hora_vuelta']) && $schedule['hora_vuelta'] !== '00:00:00') {
                        $vuelta_formato = date('H:i', strtotime($schedule['hora_vuelta']));
                        $horarios_texto[] = "$hora_formato-$vuelta_formato";
                    } else {
                        $horarios_texto[] = $hora_formato;
                    }
                }
            }
            if (!empty($horarios_texto)) {
                $filtros_texto[] = "Horarios: " . implode(', ', $horarios_texto);
            }
        }
    }

    $this->pdf->Cell(0, 6, implode(' | ', $filtros_texto), 0, 1, 'C');
    $this->pdf->Ln(8);

    // Cabecera de tabla
    $this->add_table_header();
}

    private function add_table_header()
    {
        $this->pdf->SetFont('helvetica', 'B', 8);
        $this->pdf->SetFillColor(220, 220, 220);

        // ✅ ANCHOS AJUSTADOS PARA QUE QUEPAN EN 190mm (ancho útil A4)
        // Total: 190mm
        $this->pdf->Cell(25, 8, 'Fecha', 1, 0, 'C', true);           // 25mm
        $this->pdf->Cell(50, 8, 'Servicio - Horario', 1, 0, 'C', true); // 50mm
        $this->pdf->Cell(18, 8, 'Adultos', 1, 0, 'C', true);        // 18mm
        $this->pdf->Cell(15, 8, 'Niños', 1, 0, 'C', true);          // 15mm
        $this->pdf->Cell(22, 8, 'Adultos Cord.', 1, 0, 'C', true);  // 22mm
        $this->pdf->Cell(20, 8, 'Niños Cord.', 1, 0, 'C', true);    // 20mm
        $this->pdf->Cell(20, 8, 'Total Desc.', 1, 0, 'C', true);    // 20mm
        $this->pdf->Cell(20, 8, 'Importe Total', 1, 1, 'C', true);  // 20mm

        $this->pdf->SetFont('helvetica', '', 8);
    }

    private function add_reservas_content($data)
    {
        $reservas_agrupadas = $data['reservas_agrupadas'];

        $total_general = array(
            'adultos' => 0,
            'ninos' => 0,
            'residentes' => 0,
            'ninos_residentes' => 0,
            'descuentos' => 0,
            'importe' => 0
        );

        foreach ($reservas_agrupadas as $fecha => $turnos) {
            $fecha_formateada = date('d/m/Y', strtotime($fecha));

            // Fecha como separador
            $this->pdf->SetFont('helvetica', 'B', 10);
            $this->pdf->SetFillColor(240, 240, 240);
            $this->pdf->Cell(0, 8, $fecha_formateada, 1, 1, 'L', true);

            $total_dia = array(
                'adultos' => 0,
                'ninos' => 0,
                'residentes' => 0,
                'ninos_residentes' => 0,
                'descuentos' => 0,
                'importe' => 0
            );

            foreach ($turnos as $turno => $origenes) {
                // Turno
                $this->pdf->SetFont('helvetica', 'B', 9);
                $this->pdf->Cell(70, 6, '    ' . $turno, 0, 1, 'L');

                $total_turno = array(
                    'adultos' => 0,
                    'ninos' => 0,
                    'residentes' => 0,
                    'ninos_residentes' => 0,
                    'descuentos' => 0,
                    'importe' => 0
                );

                foreach ($origenes as $origen => $datos) {
                    $this->add_origen_section($origen, $datos, $total_turno);
                }

                // Total turno
                $this->add_subtotal_row("Total Turno:", $total_turno);
                $this->add_to_total($total_dia, $total_turno);
                $this->pdf->Ln(3);
            }

            // Total día
            $this->add_subtotal_row("Total del día:", $total_dia, true);
            $this->add_to_total($total_general, $total_dia);
            $this->pdf->Ln(5);
        }

        // Total general
        $this->pdf->SetFont('helvetica', 'B', 10);
        $this->add_subtotal_row("Total listado:", $total_general, true);
    }

    private function add_origen_section($origen, $datos, &$total_turno)
{
    $this->pdf->SetFont('helvetica', '', 8);
    
    // ✅ USAR LOS MISMOS ANCHOS QUE EN LA CABECERA
    // Nombre del origen (ajustado para que quepa en las dos primeras columnas)
    $this->pdf->Cell(75, 5, '        ' . $origen, 0, 0, 'L'); // 25+50 = 75mm
    
    $totales = $datos['totales'];
    
    // Datos del origen con los mismos anchos que la cabecera
    $this->pdf->Cell(18, 5, number_format($totales['adultos']), 1, 0, 'C');
    $this->pdf->Cell(15, 5, number_format($totales['ninos']), 1, 0, 'C');
    $this->pdf->Cell(22, 5, number_format($totales['residentes']), 1, 0, 'C');
    $this->pdf->Cell(20, 5, number_format($totales['ninos_residentes']), 1, 0, 'C');
    $this->pdf->Cell(20, 5, '-' . number_format($totales['descuentos'], 2) . ' €', 1, 0, 'R');
    $this->pdf->Cell(20, 5, number_format($totales['importe'], 2) . ' €', 1, 1, 'R');
    
    // Mostrar localizadores
    $localizadores = array();
    foreach ($datos['reservas'] as $reserva) {
        $localizadores[] = $reserva->localizador;
    }
    
    if (!empty($localizadores)) {
        $this->pdf->SetFont('helvetica', '', 7);
        
        // Dividir localizadores en chunks para que no se desborde
        $chunks = array_chunk($localizadores, 6); // Reducir a 6 por línea
        foreach ($chunks as $chunk) {
            $this->pdf->Cell(75, 3, '            ' . implode(', ', $chunk), 0, 1, 'L');
        }
        
        // Añadir espacio después de los localizadores
        $this->pdf->Ln(1);
    }
    
    // Sumar al total del turno
    $this->add_to_total($total_turno, $totales);
}

    private function add_subtotal_row($label, $totales, $bold = false)
{
    if ($bold) {
        $this->pdf->SetFont('helvetica', 'B', 9);
        $this->pdf->SetFillColor(230, 230, 230);
    } else {
        $this->pdf->SetFont('helvetica', 'B', 8);
        $this->pdf->SetFillColor(245, 245, 245);
    }
    
    // ✅ USAR LOS MISMOS ANCHOS
    $this->pdf->Cell(75, 6, $label, 1, 0, 'R', true);           // 75mm (fecha + servicio)
    $this->pdf->Cell(18, 6, number_format($totales['adultos']), 1, 0, 'C', true);
    $this->pdf->Cell(15, 6, number_format($totales['ninos']), 1, 0, 'C', true);
    $this->pdf->Cell(22, 6, number_format($totales['residentes']), 1, 0, 'C', true);
    $this->pdf->Cell(20, 6, number_format($totales['ninos_residentes']), 1, 0, 'C', true);
    $this->pdf->Cell(20, 6, '-' . number_format($totales['descuentos'], 2) . '€', 1, 0, 'R', true);
    $this->pdf->Cell(20, 6, number_format($totales['importe'], 2) . '€', 1, 1, 'R', true);
}

    private function add_to_total(&$total_destino, $datos_origen)
    {
        foreach ($datos_origen as $key => $value) {
            if (isset($total_destino[$key])) {
                $total_destino[$key] += $value;
            }
        }
    }

    private function add_totales_agencias($data)
{
    $this->pdf->AddPage();
    
    // Título
    $this->pdf->SetFont('helvetica', 'B', 14);
    $this->pdf->Cell(0, 10, 'TOTALES', 0, 1, 'L');
    $this->pdf->Ln(5);
    
    // ✅ CABECERA AJUSTADA PARA QUE QUEPA EN 190mm
    $this->pdf->SetFont('helvetica', 'B', 8); // ✅ REDUCIR TAMAÑO DE FUENTE
    $this->pdf->SetFillColor(220, 220, 220);
    
    // ✅ ANCHOS AJUSTADOS PARA TOTAL: 190mm
    $this->pdf->Cell(35, 8, 'Origen', 1, 0, 'L', true);          // 35mm
    $this->pdf->Cell(18, 8, 'Adultos', 1, 0, 'C', true);        // 18mm
    $this->pdf->Cell(15, 8, 'Niños', 1, 0, 'C', true);          // 15mm
    $this->pdf->Cell(20, 8, 'Adultos Cord.', 1, 0, 'C', true);  // 20mm
    $this->pdf->Cell(18, 8, 'Niños Cord.', 1, 0, 'C', true);    // 18mm
    $this->pdf->Cell(22, 8, 'Total Desc.', 1, 0, 'C', true);    // 22mm
    $this->pdf->Cell(25, 8, 'Importe Total', 1, 0, 'C', true);  // 25mm
    $this->pdf->Cell(15, 8, 'Reservas', 1, 1, 'C', true);       // 15mm
    // Total: 168mm (deja margen)
    
    // Datos por agencia
    $this->pdf->SetFont('helvetica', '', 7); // ✅ REDUCIR MÁS EL TAMAÑO DE FUENTE
    
    foreach ($data['totales_agencias'] as $origen => $totales) {
        // ✅ TRUNCAR NOMBRE DE ORIGEN PARA QUE QUEPA
        $origen_truncado = strlen($origen) > 20 ? substr($origen, 0, 17) . '...' : $origen;
        
        $this->pdf->Cell(35, 6, $origen_truncado, 1, 0, 'L');
        $this->pdf->Cell(18, 6, number_format($totales['adultos']), 1, 0, 'C');
        $this->pdf->Cell(15, 6, number_format($totales['ninos']), 1, 0, 'C');
        $this->pdf->Cell(20, 6, number_format($totales['residentes']), 1, 0, 'C');
        $this->pdf->Cell(18, 6, number_format($totales['ninos_residentes']), 1, 0, 'C');
        $this->pdf->Cell(22, 6, '-' . number_format($totales['descuentos'], 2) . '€', 1, 0, 'R');
        $this->pdf->Cell(25, 6, number_format($totales['importe'], 2) . '€', 1, 0, 'R');
        $this->pdf->Cell(15, 6, number_format($totales['count']), 1, 1, 'C');
    }
    
    // ✅ AÑADIR TOTAL GENERAL AL FINAL
    $this->add_grand_total($data['totales_agencias']);
}

private function add_grand_total($totales_agencias)
{
    $gran_total = array(
        'adultos' => 0,
        'ninos' => 0,
        'residentes' => 0,
        'ninos_residentes' => 0,
        'descuentos' => 0,
        'importe' => 0,
        'count' => 0
    );
    
    // Sumar todos los totales
    foreach ($totales_agencias as $totales) {
        $gran_total['adultos'] += $totales['adultos'];
        $gran_total['ninos'] += $totales['ninos'];
        $gran_total['residentes'] += $totales['residentes'];
        $gran_total['ninos_residentes'] += $totales['ninos_residentes'];
        $gran_total['descuentos'] += $totales['descuentos'];
        $gran_total['importe'] += $totales['importe'];
        $gran_total['count'] += $totales['count'];
    }
    
    $this->pdf->Ln(3);
    
    // Línea de total general
    $this->pdf->SetFont('helvetica', 'B', 9);
    $this->pdf->SetFillColor(200, 200, 200);
    
    $this->pdf->Cell(35, 8, 'TOTAL GENERAL', 1, 0, 'R', true);
    $this->pdf->Cell(18, 8, number_format($gran_total['adultos']), 1, 0, 'C', true);
    $this->pdf->Cell(15, 8, number_format($gran_total['ninos']), 1, 0, 'C', true);
    $this->pdf->Cell(20, 8, number_format($gran_total['residentes']), 1, 0, 'C', true);
    $this->pdf->Cell(18, 8, number_format($gran_total['ninos_residentes']), 1, 0, 'C', true);
    $this->pdf->Cell(22, 8, '-' . number_format($gran_total['descuentos'], 2) . '€', 1, 0, 'R', true);
    $this->pdf->Cell(25, 8, number_format($gran_total['importe'], 2) . '€', 1, 0, 'R', true);
    $this->pdf->Cell(15, 8, number_format($gran_total['count']), 1, 1, 'C', true);
}


}
