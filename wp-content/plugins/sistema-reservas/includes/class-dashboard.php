<?php
class ReservasDashboard
{

    public function __construct()
    {
        // Inicializar hooks
    }

    public function handle_logout()
    {
        if (!session_id()) {
            session_start();
        }
        session_destroy();
        wp_redirect(home_url('/reservas-login/?logout=success'));
        exit;
    }

    public function show_login()
    {
        if ($_POST && isset($_POST['username']) && isset($_POST['password'])) {
            $this->process_login();
        }

        $this->render_login_page();
    }

    public function show_dashboard()
    {
        if (!session_id()) {
            session_start();
        }

        if (!isset($_SESSION['reservas_user'])) {
            wp_redirect(home_url('/reservas-login/?error=access'));
            exit;
        }

        $this->render_dashboard_page();
    }

    private function render_login_page()
    {
?>
        <!DOCTYPE html>
        <html <?php language_attributes(); ?>>

        <head>
            <meta charset="<?php bloginfo('charset'); ?>">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Sistema de Reservas - Login</title>
            <link rel="stylesheet" href="<?php echo RESERVAS_PLUGIN_URL; ?>assets/css/admin-style.css">
        </head>

        <body>
            <div class="login-container">
                <h2>Sistema de Reservas</h2>

                <?php if (isset($_GET['error'])): ?>
                    <div class="error">
                        <?php echo $this->get_error_message($_GET['error']); ?>
                    </div>
                <?php endif; ?>

                <?php if (isset($_GET['success'])): ?>
                    <div class="success">Login correcto. Redirigiendo...</div>
                <?php endif; ?>

                <?php if (isset($_GET['logout']) && $_GET['logout'] == 'success'): ?>
                    <div class="success">Sesión cerrada correctamente.</div>
                <?php endif; ?>

                <form method="post" action="">
                    <div class="form-group">
                        <label for="username">Usuario:</label>
                        <input type="text" id="username" name="username" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Contraseña:</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    <button type="submit" class="btn-login">Iniciar Sesión</button>
                </form>

                <div class="info-box" style="margin-top: 20px; background: #e8f4f8; border-left: 4px solid #0073aa;">
                    <h4>Acceso para Agencias/Conductor</h4>
                    <p>Si eres una agencia, utiliza las credenciales que te proporcionó el administrador.</p>
                    <p><em>Contacta con el administrador si tienes problemas de acceso.</em></p>
                </div>
            </div>
        </body>

        </html>
    <?php
    }

    private function render_dashboard_page()
    {
        $user = $_SESSION['reservas_user'];
        $is_agency = ($user['role'] === 'agencia');
        $is_super_admin = ($user['role'] === 'super_admin');
        $is_admin = in_array($user['role'], ['super_admin', 'admin']);
    ?>
        <!DOCTYPE html>
        <html <?php language_attributes(); ?>>

        <head>
            <meta charset="<?php bloginfo('charset'); ?>">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Sistema de Reservas - Dashboard</title>
            <link rel="stylesheet" href="<?php echo RESERVAS_PLUGIN_URL; ?>assets/css/admin-style.css">
            <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
            <script src="<?php echo RESERVAS_PLUGIN_URL; ?>assets/js/dashboard-script.js"></script>
            <script>
                const reservasAjax = {
                    ajax_url: '<?php echo admin_url('admin-ajax.php'); ?>',
                    nonce: '<?php echo wp_create_nonce('reservas_nonce'); ?>'
                };

                // ✅ AÑADIR INFORMACIÓN DEL USUARIO ACTUAL
                window.reservasUser = {
                    role: '<?php echo esc_js($user['role']); ?>',
                    username: '<?php echo esc_js($user['username']); ?>',
                    user_type: '<?php echo esc_js($user['user_type'] ?? 'admin'); ?>'
                };
            </script>

            <style>
                <?php
                $reports_css = RESERVAS_PLUGIN_PATH . 'assets/css/reports-styles.css';
                if (file_exists($reports_css)) {
                    include_once $reports_css;
                } else {
                    echo '.loading { text-align: center; padding: 40px; color: #666; }';
                }
                ?><?php
                    $reports_css = RESERVAS_PLUGIN_PATH . 'assets/css/admin-style.css';
                    if (file_exists($reports_css)) {
                        include_once $reports_css;
                    }
                    ?>.loading {
                    text-align: center;
                    padding: 40px;
                    color: #666;
                }

                .error {
                    background: #fbeaea;
                    border-left: 4px solid #d63638;
                    padding: 12px;
                    margin: 15px 0;
                    border-radius: 4px;
                    color: #d63638;
                }

                .agency-welcome {
                    background: linear-gradient(135deg, #0073aa 0%, #005177 100%);
                    color: white;
                    padding: 30px;
                    border-radius: 8px;
                    margin-bottom: 30px;
                    text-align: center;
                }

                .agency-welcome h2 {
                    margin: 0 0 10px 0;
                    font-size: 28px;
                }

                .agency-welcome p {
                    margin: 0;
                    font-size: 16px;
                    opacity: 0.9;
                }

                .agency-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }

                .agency-stat-card {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    border-left: 4px solid #0073aa;
                }

                .agency-stat-card h3 {
                    margin: 0 0 10px 0;
                    color: #23282d;
                    font-size: 14px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .agency-stat-card .stat-number {
                    font-size: 32px;
                    font-weight: bold;
                    color: #0073aa;
                    margin: 10px 0;
                }

                .agency-stat-card p {
                    margin: 0;
                    color: #666;
                    font-size: 14px;
                }
            </style>
        </head>

        <body>
            <div class="dashboard-header">
                <h1>Sistema de Reservas</h1>
                <div class="user-info">
                    <span>Bienvenido, <?php echo esc_html($user['username']); ?></span>
                    <span class="user-role"><?php echo esc_html($user['role']); ?></span>
                    <?php if ($is_agency): ?>
                        <span class="agency-name">(<?php echo esc_html($user['agency_name'] ?? 'Agencia'); ?>)</span>
                    <?php endif; ?>
                    <a href="<?php echo home_url('/reservas-login/?logout=1'); ?>" class="btn-logout">Cerrar Sesión</a>
                </div>
            </div>

            <div class="dashboard-content">
                <?php if ($is_agency): ?>
                    <!-- Dashboard para Agencias -->
                    <div class="agency-welcome">
                        <h2>¡Bienvenido <?php echo esc_html($user['agency_name'] ?? $user['username']); ?>!</h2>
                        <p>Panel de control para agencias - Gestiona tus reservas y consulta tu información</p>
                    </div>

                    <div class="agency-stats">
                        <div class="agency-stat-card">
                            <h3>Estado</h3>
                            <div class="stat-number">✓</div>
                            <p>Agencia activa</p>
                        </div>
                        <div class="agency-stat-card">
                            <h3>CIF</h3>
                            <div class="stat-number"><?php echo !empty($user['cif']) ? esc_html($user['cif']) : '-'; ?></div>
                            <p>Identificación fiscal</p>
                        </div>
                        <div class="agency-stat-card">
                            <h3>Datos Fiscales</h3>
                            <div class="stat-number"><?php echo (!empty($user['cif']) && !empty($user['razon_social'])) ? '✓' : '⚠️'; ?></div>
                            <p><?php echo (!empty($user['cif']) && !empty($user['razon_social'])) ? 'Completos' : 'Incompletos'; ?></p>
                        </div>
                    </div>

                    <div class="menu-actions">
                        <h3>Funciones Disponibles</h3>
                        <div class="action-buttons">
                            <button class="action-btn" onclick="loadAgencyReservations()">🎫 Mis Reservas</button>

                            <button class="action-btn" onclick="loadAgencyProfile()">👤 Mi Perfil</button>
                            <button class="action-btn" onclick="initAgencyReservaRapida()" style="background: linear-gradient(135deg, #0073aa 0%, #005177 100%); border-left: 4px solid #003f5c;">⚡ Reserva Rápida</button>
                        </div>
                    </div>

                <?php else: ?>
                    <!-- Dashboard para Administradores -->
                    <div class="welcome-card">
                        <h2>Dashboard Principal</h2>
                        <p class="status-active">✅ El sistema está funcionando correctamente</p>
                        <p>Has iniciado sesión correctamente en el sistema de reservas.</p>
                    </div>

                    <div class="stats-grid">
                        <div class="stat-card">
                            <h3>Estado del Sistema</h3>
                            <div class="stat-number">✓</div>
                            <p>Operativo</p>
                        </div>
                        <div class="stat-card">
                            <h3>Tu Rol</h3>
                            <div class="stat-number"><?php echo strtoupper($user['role']); ?></div>
                            <p>Nivel de acceso</p>
                        </div>
                        <div class="stat-card">
                            <h3>Versión</h3>
                            <div class="stat-number">1.0</div>
                            <p>Sistema base</p>
                        </div>

                        <?php if ($is_admin): ?>
                            <div class="stat-card">
                                <h3>Reservas Hoy</h3>
                                <div class="stat-number"><?php echo $this->get_reservas_today(); ?></div>
                                <p>Confirmadas</p>
                            </div>
                        <?php endif; ?>
                    </div>

                    <?php if ($is_super_admin): ?>
                        <div class="menu-actions">
                            <h3>Acciones Disponibles</h3>
                            <div class="action-buttons">
                                <button class="action-btn" onclick="loadCalendarSection()">📅 Gestionar Calendario</button>
                                <button class="action-btn" onclick="loadDiscountsConfigSection()">💰 Configurar Descuentos</button>
                                <button class="action-btn" onclick="loadConfigurationSection()">⚙️ Configuración</button>
                                <button class="action-btn" onclick="loadReportsSection()">📊 Informes y Reservas</button>
                                <button class="action-btn" onclick="loadAdminReservaRapida()" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); border-left: 4px solid #155724;">⚡ Reserva Rápida</button>
                                <button class="action-btn" onclick="loadAgenciesSection()">🏢 Gestionar Agencias</button>
                            </div>
                        </div>
                    <?php elseif ($is_admin): ?>
                        <div class="menu-actions">
                            <h3>Acciones Disponibles</h3>
                            <div class="action-buttons">
                                <button class="action-btn" onclick="loadCalendarSection()">📅 Gestionar Calendario</button>
                                <button class="action-btn" onclick="loadReportsSection()">📊 Informes y Reservas</button>
                                <button class="action-btn" onclick="loadAdminReservaRapida()" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); border-left: 4px solid #155724;">⚡ Reserva Rápida</button>
                                <button class="action-btn" onclick="alert('Función en desarrollo')">📈 Ver Estadísticas</button>
                            </div>
                        </div>
                    <?php endif; ?>

                <?php endif; ?>

            </div>
        </body>

        </html>
<?php
    }

    private function get_reservas_today()
    {
        global $wpdb;
        $table_name = $wpdb->prefix . 'reservas_reservas';

        $count = $wpdb->get_var("
        SELECT COUNT(*) 
        FROM $table_name 
        WHERE fecha = CURDATE() 
        AND estado = 'confirmada'
    ");

        return $count ? $count : 0;
    }

    private function process_login()
    {
        $username = sanitize_text_field($_POST['username']);
        $password = $_POST['password'];

        // Intentar login como administrador
        global $wpdb;
        $table_users = $wpdb->prefix . 'reservas_users';

        $user = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table_users WHERE username = %s AND status = 'active'",
            $username
        ));

        if ($user && password_verify($password, $user->password)) {
            $this->create_admin_session($user);
            wp_redirect(home_url('/reservas-admin/?success=1'));
            exit;
        }

        // Si no es admin, intentar login como agencia
        if (!class_exists('ReservasAgenciesAdmin')) {
            require_once RESERVAS_PLUGIN_PATH . 'includes/class-agencies-admin.php';
        }

        $agency_result = ReservasAgenciesAdmin::authenticate_agency($username, $password);

        if ($agency_result['success']) {
            $this->create_agency_session($agency_result['agency']);
            wp_redirect(home_url('/reservas-admin/?success=1'));
            exit;
        }

        // Si ninguno funciona, error
        wp_redirect(home_url('/reservas-login/?error=invalid'));
        exit;
    }

    private function create_admin_session($user)
    {
        if (!session_id()) {
            session_start();
        }

        $_SESSION['reservas_user'] = array(
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'role' => $user->role,
            'user_type' => 'admin',
            'login_time' => time()
        );
    }

    private function create_agency_session($agency)
    {
        if (!session_id()) {
            session_start();
        }

        $_SESSION['reservas_user'] = $agency;
        $_SESSION['reservas_user']['user_type'] = 'agency';
        $_SESSION['reservas_user']['login_time'] = time();
    }

    public function get_error_message($error)
    {
        switch ($error) {
            case 'invalid':
                return 'Usuario o contraseña incorrectos.';
            case 'access':
                return 'Debes iniciar sesión para acceder.';
            case 'suspended':
                return 'Tu cuenta de agencia está suspendida. Contacta con el administrador.';
            case 'inactive':
                return 'Tu cuenta de agencia está inactiva. Contacta con el administrador.';
            default:
                return 'Error desconocido.';
        }
    }
}
