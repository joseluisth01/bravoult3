<?php

/**
 * Clase para generar PDFs de billetes idénticos al diseño original - ARREGLADA
 * Archivo: wp-content/plugins/sistema-reservas/includes/class-pdf-generator.php
 */

require_once(ABSPATH . 'wp-admin/includes/file.php');

class ReservasPDFGenerator
{

    private $reserva_data;
    private $font_path;

    public function __construct()
    {
        // ✅ CARGAR TCPDF USANDO COMPOSER AUTOLOADER
        $this->load_tcpdf();
    }

    /**
     * ✅ FUNCIÓN MEJORADA PARA CARGAR TCPDF
     */
    private function load_tcpdf()
    {
        error_log('=== INTENTANDO CARGAR TCPDF ===');

        // ✅ Verificar si ya está disponible
        if (class_exists('TCPDF')) {
            error_log('✅ TCPDF ya estaba disponible');
            return;
        }

        // ✅ Rutas posibles para TCPDF
        $possible_paths = array(
            RESERVAS_PLUGIN_PATH . 'vendor/autoload.php',
            RESERVAS_PLUGIN_PATH . 'vendor/tecnickcom/tcpdf/tcpdf.php',
            RESERVAS_PLUGIN_PATH . 'vendor/tcpdf/tcpdf.php'
        );

        foreach ($possible_paths as $path) {
            error_log("Verificando: $path");
            if (file_exists($path)) {
                error_log("✅ Encontrado: $path");
                try {
                    require_once($path);
                    if (class_exists('TCPDF')) {
                        error_log('✅ TCPDF cargado desde: ' . $path);
                        return;
                    }
                } catch (Exception $e) {
                    error_log("Error cargando $path: " . $e->getMessage());
                }
            } else {
                error_log("❌ No existe: $path");
            }
        }

        // ✅ Si no encuentra nada, listar contenido del directorio vendor
        $vendor_dir = RESERVAS_PLUGIN_PATH . 'vendor/';
        if (is_dir($vendor_dir)) {
            error_log('Contenido de vendor:');
            $files = scandir($vendor_dir);
            foreach ($files as $file) {
                if ($file != '.' && $file != '..') {
                    error_log("  - $file");
                    if (is_dir($vendor_dir . $file)) {
                        $subfiles = scandir($vendor_dir . $file);
                        foreach ($subfiles as $subfile) {
                            if ($subfile != '.' && $subfile != '..') {
                                error_log("    - $file/$subfile");
                            }
                        }
                    }
                }
            }
        }

        throw new Exception('TCPDF no se pudo cargar desde ninguna ubicación');
    }

    /**
     * Generar PDF del billete
     */
    public function generate_ticket_pdf($reserva_data)
    {
        $this->reserva_data = $reserva_data;

        // ✅ VERIFICAR QUE TCPDF ESTÁ DISPONIBLE
        if (!class_exists('TCPDF')) {
            error_log('❌ TCPDF no está disponible para generar PDF');
            throw new Exception('TCPDF no está disponible. El PDF no se puede generar.');
        }

        error_log('✅ Iniciando generación de PDF para localizador: ' . $reserva_data['localizador']);

        // Crear instancia de TCPDF
        $pdf = new TCPDF('P', 'mm', 'A4', true, 'UTF-8', false);

        // Configuración del documento
        $pdf->SetCreator('Sistema de Reservas');
        $pdf->SetAuthor('Autocares Bravo Palacios');
        $pdf->SetTitle('Billete - ' . $reserva_data['localizador']);
        $pdf->SetSubject('Billete de reserva Medina Azahara');

        // Configurar márgenes
        $pdf->SetMargins(10, 10, 10);
        $pdf->SetAutoPageBreak(false, 10);

        // ✅ DESHABILITAR HEADER Y FOOTER AUTOMÁTICOS
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);

        // Añadir página
        $pdf->AddPage();

        // Generar contenido del billete
        $this->generate_ticket_content($pdf);

        // Nombre del archivo
        $filename = 'billete_' . $reserva_data['localizador'] . '_' . date('YmdHis') . '.pdf';

        // ✅ GUARDAR PDF EN DIRECTORIO TEMPORAL DE WORDPRESS
        $upload_dir = wp_upload_dir();
        $temp_path = $upload_dir['path'] . '/' . $filename;

        // ✅ VERIFICAR QUE EL DIRECTORIO EXISTE Y ES ESCRIBIBLE
        if (!wp_mkdir_p($upload_dir['path'])) {
            error_log('❌ No se pudo crear directorio para PDF: ' . $upload_dir['path']);
            throw new Exception('No se pudo crear directorio para PDF');
        }

        try {
            $pdf->Output($temp_path, 'F');
            error_log('✅ PDF generado exitosamente: ' . $temp_path);

            // ✅ VERIFICAR QUE EL ARCHIVO SE CREÓ CORRECTAMENTE
            if (!file_exists($temp_path) || filesize($temp_path) == 0) {
                error_log('❌ PDF no se generó correctamente o está vacío');
                throw new Exception('Error generando PDF: archivo vacío o no creado');
            }

            error_log('✅ PDF verificado - Tamaño: ' . filesize($temp_path) . ' bytes');
            return $temp_path;
        } catch (Exception $e) {
            error_log('❌ Error generando PDF: ' . $e->getMessage());
            throw new Exception('Error generando PDF: ' . $e->getMessage());
        }
    }

    /**
     * Generar el contenido del billete
     */
    private function generate_ticket_content($pdf)
    {
        // Configurar fuente por defecto
        $pdf->SetFont('helvetica', '', 9);

        // ========== SECCIÓN PRINCIPAL DEL BILLETE ==========
        $this->generate_main_ticket_section($pdf);

        // ========== SECCIÓN DEL TALÓN (DESPRENDIBLE) ==========
        $this->generate_stub_section($pdf);

        // ========== CONDICIONES DE COMPRA ==========
        $this->generate_conditions_section($pdf);

        // ✅ AÑADIR CÓDIGO DE BARRAS AL FINAL
        $this->generate_simple_barcode($pdf, 245);
    }





    /**
     * Sección principal del billete
     */
    private function generate_main_ticket_section($pdf)
    {
        $y_start = 15;

        // TABLA DE PRODUCTOS Y PRECIOS (PARTE SUPERIOR)
        $pdf->SetFont('helvetica', 'B', 9);
        $pdf->SetXY(15, $y_start);

        // Headers de la tabla
        $pdf->Cell(15, 6, 'Unidades', 1, 0, 'C', false);
        $pdf->Cell(80, 6, 'Plazas:', 1, 0, 'L', false);
        $pdf->Cell(25, 6, 'Precio:', 1, 0, 'C', false);
        $pdf->Cell(25, 6, 'Total:', 1, 1, 'C', false);

        $pdf->SetFont('helvetica', '', 9);

        // Línea de adultos
        if ($this->reserva_data['adultos'] > 0) {
            $precio_adulto = $this->get_precio_adulto();
            $total_adultos = $this->reserva_data['adultos'] * $precio_adulto;

            $pdf->SetX(15);
            $pdf->Cell(15, 5, $this->reserva_data['adultos'], 1, 0, 'C');
            $pdf->Cell(80, 5, 'Adultos', 1, 0, 'L');
            $pdf->Cell(25, 5, number_format($precio_adulto, 2) . ' €', 1, 0, 'C');
            $pdf->Cell(25, 5, number_format($total_adultos, 2) . ' €', 1, 1, 'C');
        }

        // Línea de residentes
        if ($this->reserva_data['residentes'] > 0) {
            $precio_residente = $this->get_precio_residente();
            $total_residentes = $this->reserva_data['residentes'] * $precio_residente;

            $pdf->SetX(15);
            $pdf->Cell(15, 5, $this->reserva_data['residentes'], 1, 0, 'C');
            $pdf->Cell(80, 5, 'Residentes', 1, 0, 'L');
            $pdf->Cell(25, 5, number_format($precio_residente, 2) . ' €', 1, 0, 'C');
            $pdf->Cell(25, 5, number_format($total_residentes, 2) . ' €', 1, 1, 'C');
        }

        // Línea de niños (5-12)
        if ($this->reserva_data['ninos_5_12'] > 0) {
            $precio_nino = $this->get_precio_nino();
            $total_ninos = $this->reserva_data['ninos_5_12'] * $precio_nino;

            $pdf->SetX(15);
            $pdf->Cell(15, 5, $this->reserva_data['ninos_5_12'], 1, 0, 'C');
            $pdf->Cell(80, 5, 'Niños (5 a 12 años) (5-12 a.)', 1, 0, 'L');
            $pdf->Cell(25, 5, number_format($precio_nino, 2) . ' €', 1, 0, 'C');
            $pdf->Cell(25, 5, number_format($total_ninos, 2) . ' €', 1, 1, 'C');
        }

        // Línea de niños menores (gratis) - si existen
        if (isset($this->reserva_data['ninos_menores']) && $this->reserva_data['ninos_menores'] > 0) {
            $pdf->SetX(15);
            $pdf->Cell(15, 5, $this->reserva_data['ninos_menores'], 1, 0, 'C');
            $pdf->Cell(80, 5, 'Niños (menores 5 años)', 1, 0, 'L');
            $pdf->Cell(25, 5, '0,00 €', 1, 0, 'C');
            $pdf->Cell(25, 5, '0,00 €', 1, 1, 'C');
        }

        // FILA DEL TOTAL
        $pdf->SetFont('helvetica', 'B', 11);
        $pdf->SetX(95);
        $pdf->Cell(50, 8, number_format($this->reserva_data['precio_final'], 2) . ' €', 1, 1, 'C');

        $y_current = $pdf->GetY() + 5;

        // TÍTULO DEL PRODUCTO
        $pdf->SetFont('helvetica', 'B', 12);
        $pdf->SetXY(15, $y_current);
        $pdf->Cell(0, 6, 'TAQ BUS Madinat Al-Zahra + Lanzadera (' . substr($this->reserva_data['hora'], 0, 5) . ' hrs)', 0, 1, 'L');

        $y_current = $pdf->GetY() + 3;

        // INFORMACIÓN DEL SERVICIO EN DOS COLUMNAS
        $pdf->SetFont('helvetica', 'B', 9);
        $pdf->SetXY(15, $y_current);
        $pdf->Cell(30, 5, 'Fecha Visita:', 0, 0, 'L');
        $pdf->SetFont('helvetica', '', 9);
        $pdf->Cell(40, 5, $this->format_date($this->reserva_data['fecha']), 0, 0, 'L');

        // Localizador en la esquina superior derecha
        $pdf->SetFont('helvetica', 'B', 9);
        $pdf->SetXY(120, $y_current);
        $pdf->Cell(30, 5, 'Localizador/Localizer:', 0, 1, 'L');
        $pdf->SetFont('helvetica', 'B', 12);
        $pdf->SetX(150);
        $pdf->Cell(30, 5, $this->reserva_data['localizador'], 0, 1, 'L');

        $pdf->SetFont('helvetica', 'B', 9);
        $pdf->SetX(15);
        $pdf->Cell(30, 5, 'Hora de Salida:', 0, 0, 'L');
        $pdf->SetFont('helvetica', '', 9);
        $pdf->Cell(40, 5, substr($this->reserva_data['hora'], 0, 5) . ' hrs', 0, 1, 'L');

        $pdf->SetFont('helvetica', 'B', 9);
        $pdf->SetX(15);
        $pdf->Cell(30, 5, 'Hora de Vuelta:', 0, 0, 'L');
        $pdf->SetFont('helvetica', '', 9);
        $pdf->Cell(40, 5, substr($this->reserva_data['hora_vuelta'], 0, 5) . ' hrs', 0, 1, 'L');

        $pdf->SetFont('helvetica', 'B', 9);
        $pdf->SetX(15);
        $pdf->Cell(30, 5, 'Idioma:', 0, 0, 'L');
        $pdf->SetFont('helvetica', '', 9);
        $pdf->Cell(40, 5, 'Español', 0, 1, 'L');

        $pdf->SetFont('helvetica', 'B', 9);
        $pdf->SetX(15);
        $pdf->Cell(30, 5, 'Producto:', 0, 0, 'L');
        $pdf->SetFont('helvetica', '', 9);
        $pdf->MultiCell(80, 5, 'TAQ BUS Madinat Al-Zahra + Lanzadera (' . substr($this->reserva_data['hora'], 0, 5) . ' hrs)', 0, 'L');

        $y_current = $pdf->GetY() + 3;

        // FECHA DE COMPRA
        $pdf->SetFont('helvetica', 'B', 9);
        $pdf->SetXY(15, $y_current);
        $pdf->Cell(30, 5, 'Fecha Compra:', 0, 0, 'L');
        $pdf->SetFont('helvetica', '', 9);
        $pdf->Cell(40, 5, $this->format_date($this->reserva_data['created_at'] ?? date('Y-m-d')), 0, 1, 'L');

        $y_current = $pdf->GetY() + 5;

        // PUNTO DE ENCUENTRO
        $pdf->SetFont('helvetica', 'B', 9);
        $pdf->SetXY(15, $y_current);
        $pdf->Cell(35, 5, 'Punto de Encuentro:', 0, 1, 'L');

        $pdf->SetFont('helvetica', '', 8);
        $pdf->SetX(15);
        $pdf->Cell(0, 4, '1-Paseo de la Victoria (glorieta Hospital Cruz Roja)', 0, 1, 'L');
        $pdf->SetX(15);
        $pdf->Cell(0, 4, '2-Paseo de la Victoria (frente Mercado Victoria)', 0, 1, 'L');

        $y_current = $pdf->GetY() + 3;

        // CLIENTE/AGENTE
        $pdf->SetFont('helvetica', 'B', 9);
        $pdf->SetXY(15, $y_current);
        $pdf->Cell(25, 5, 'Cliente/Agente:', 0, 0, 'L');
        $pdf->SetFont('helvetica', '', 8);
        $pdf->Cell(0, 5, 'TAQUILLA BRAVO BUS - FRANCISCO BRAVO', 0, 1, 'L');

        $y_current = $pdf->GetY() + 3;

        // ORGANIZA
        $pdf->SetFont('helvetica', 'B', 9);
        $pdf->SetXY(15, $y_current);
        $pdf->Cell(20, 5, 'Organiza:', 0, 1, 'L');

        $pdf->SetFont('helvetica', 'B', 9);
        $pdf->SetX(15);
        $pdf->Cell(0, 4, 'AUTOCARES BRAVO PALACIOS,S.L.', 0, 1, 'L');

        $pdf->SetFont('helvetica', '', 7);
        $pdf->SetX(15);
        $pdf->Cell(0, 4, 'INGENIERO BARBUDO, S/N - CORDOBA - CIF: B14485817 - Teléfono: 957429034', 0, 1, 'L');
    }

    /**
     * Sección del talón (parte desprendible)
     */
    private function generate_stub_section($pdf)
    {
        $y_start = 95;

        // MARCO DEL TALÓN (lado derecho)
        $pdf->Rect(125, $y_start, 70, 55);

        // LOCALIZADOR GRANDE EN EL TALÓN
        $pdf->SetFont('helvetica', 'B', 10);
        $pdf->SetXY(127, $y_start + 5);
        $pdf->Cell(66, 6, 'Localizador/Localizer:', 0, 1, 'C');

        $pdf->SetFont('helvetica', 'B', 16);
        $pdf->SetX(127);
        $pdf->Cell(66, 8, $this->reserva_data['localizador'], 0, 1, 'C');

        // INFORMACIÓN DEL TALÓN
        $pdf->SetFont('helvetica', 'B', 8);
        $pdf->SetXY(127, $y_start + 20);
        $pdf->Cell(25, 4, 'Fecha Compra:', 0, 0, 'L');
        $pdf->SetFont('helvetica', '', 8);
        $pdf->Cell(40, 4, $this->format_date($this->reserva_data['created_at'] ?? date('Y-m-d')), 0, 1, 'L');

        $pdf->SetFont('helvetica', 'B', 8);
        $pdf->SetX(127);
        $pdf->Cell(25, 4, 'Producto:', 0, 0, 'L');
        $pdf->SetFont('helvetica', '', 7);
        $pdf->SetX(152);
        $pdf->MultiCell(40, 3, 'TAQ BUS Madinat Al-Zahra + Lanzadera (' . substr($this->reserva_data['hora'], 0, 5) . ' / ' . substr($this->reserva_data['hora_vuelta'], 0, 5) . ' hrs)', 0, 'L');

        $pdf->SetFont('helvetica', 'B', 8);
        $pdf->SetXY(127, $y_start + 30);
        $pdf->Cell(25, 4, 'Fecha Visita:', 0, 0, 'L');
        $pdf->SetFont('helvetica', '', 8);
        $pdf->Cell(40, 4, $this->format_date($this->reserva_data['fecha']), 0, 1, 'L');

        $pdf->SetFont('helvetica', 'B', 8);
        $pdf->SetX(127);
        $pdf->Cell(25, 4, 'Hora de Salida:', 0, 0, 'L');
        $pdf->SetFont('helvetica', '', 8);
        $pdf->Cell(40, 4, substr($this->reserva_data['hora'], 0, 5) . ' hrs', 0, 1, 'L');

        $pdf->SetFont('helvetica', 'B', 8);
        $pdf->SetX(127);
        $pdf->Cell(25, 4, 'Idioma:', 0, 0, 'L');
        $pdf->SetFont('helvetica', '', 8);
        $pdf->Cell(40, 4, 'Español', 0, 1, 'L');

        // TOTAL EN EL TALÓN
        $pdf->SetFont('helvetica', 'B', 11);
        $pdf->SetXY(127, $y_start + 48);
        $pdf->Cell(66, 6, 'Total: ' . number_format($this->reserva_data['precio_final'], 2) . ' €', 0, 0, 'C');

        // INFORMACIÓN DE LA EMPRESA EN EL TALÓN
        $pdf->SetFont('helvetica', 'B', 7);
        $pdf->SetXY(127, $y_start + 57);
        $pdf->Cell(66, 3, 'Organiza:', 0, 1, 'L');
        $pdf->SetX(127);
        $pdf->Cell(66, 3, 'AUTOCARES BRAVO PALACIOS,S.L.', 0, 1, 'L');
        $pdf->SetFont('helvetica', '', 6);
        $pdf->SetX(127);
        $pdf->Cell(66, 3, 'INGENIERO BARBUDO, S/N - CORDOBA - CIF: B14485817 - Teléfono: 957429034', 0, 1, 'L');


$pdf->SetFont('helvetica', '', 7);
$pdf->SetXY(127, $y_start + 63);
$fecha_formato = date('Ymd', strtotime($this->reserva_data['fecha']));
$codigo_completo = $this->reserva_data['localizador'] . $fecha_formato;
$pdf->Cell(66, 3, 'Código: ' . $codigo_completo, 0, 1, 'C');
    }

    /**
     * Sección de condiciones de compra
     */
    private function generate_conditions_section($pdf)
    {
        $y_start = 155;

        $pdf->SetFont('helvetica', 'B', 9);
        $pdf->SetXY(15, $y_start);
        $pdf->Cell(0, 5, 'CONDICIONES DE COMPRA', 0, 1, 'C');

        $pdf->SetFont('helvetica', '', 6);
        $conditions_text = "La adquisición de la entrada supone la aceptación de las siguientes condiciones- No se admiten devoluciones ni cambios de entradas.- La Organización no garantiza la autenticidad de la entrada si ésta no ha sido adquirida en los puntos oficiales de venta.- En caso de suspensión del servicio, la devolución se efectuará por la Organización dentro del plazo de 15 días de la fecha de celebración.- En caso de suspensión del servicio, una vez iniciado, no habrá derecho a devolución del importe de la entrada.- La Organización no se responsabiliza de posibles demoras ajenas a su voluntad.- Es potestad de la Organización permitir la entrada al servicio una vez haya empezado.- La admisión se supedita a la disposición de la entrada en buenas condiciones.- Debe de estar en el punto de salida 10 minutos antes de la hora prevista de partida.";

        $pdf->SetXY(15, $y_start + 7);
        $pdf->MultiCell(180, 3, $conditions_text, 1, 'J');

        $pdf->SetFont('helvetica', 'B', 7);
        $pdf->SetXY(15, $y_start + 30);
        $pdf->Cell(0, 3, 'Mantenga la integridad de toda la hoja, sin cortar ninguna de las zonas impresas.', 0, 1, 'C');
    }

    /**
     * Generar código de barras simple en el pie del billete
     */
private function generate_simple_barcode($pdf, $y_start)
{
    // ✅ USAR LOCALIZADOR NUMÉRICO + FECHA (formato YYYYMMDD)
    $fecha_formato = date('Ymd', strtotime($this->reserva_data['fecha']));
    $barcode_data = $this->reserva_data['localizador'] . $fecha_formato;
    
    error_log("Generando código de barras: Localizador=" . $this->reserva_data['localizador'] . " + Fecha=" . $fecha_formato . " = " . $barcode_data);

    // Posicionar código de barras
    $pdf->SetXY(15, $y_start);

    // ✅ USAR CODE 128 (mejor para combinación de números)
    $style = array(
        'border' => false,
        'hpadding' => 0,
        'vpadding' => 0,
        'fgcolor' => array(0, 0, 0),
        'bgcolor' => false,
        'text' => true,
        'font' => 'helvetica',
        'fontsize' => 8,
        'stretchtext' => 4
    );

    // Generar código de barras CODE 128 (mejor para números largos)
    $pdf->write1DBarcode($barcode_data, 'C128', 15, $y_start, 120, 15, 0.4, $style, 'N');

    // Total a la derecha del código de barras
    $pdf->SetFont('helvetica', 'B', 12);
    $pdf->SetXY(150, $y_start + 5);
    $pdf->Cell(40, 6, 'Total: ' . number_format($this->reserva_data['precio_final'], 2) . ' €', 0, 1, 'R');
}

    /**
     * Métodos auxiliares
     */
    private function format_date($date_string)
    {
        if (empty($date_string)) {
            return date('d/m/Y');
        }

        // Si es solo fecha (Y-m-d)
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date_string)) {
            $date = DateTime::createFromFormat('Y-m-d', $date_string);
            return $date ? $date->format('d/m/Y') : date('d/m/Y');
        }

        // Si es datetime completo
        try {
            $date = new DateTime($date_string);
            return $date->format('d/m/Y');
        } catch (Exception $e) {
            return date('d/m/Y');
        }
    }

    private function get_precio_adulto()
    {
        return isset($this->reserva_data['precio_adulto']) ?
            floatval($this->reserva_data['precio_adulto']) : 10.00;
    }

    private function get_precio_nino()
    {
        return isset($this->reserva_data['precio_nino']) ?
            floatval($this->reserva_data['precio_nino']) : 5.00;
    }

    private function get_precio_residente()
    {
        return isset($this->reserva_data['precio_residente']) ?
            floatval($this->reserva_data['precio_residente']) : 5.00;
    }
}
