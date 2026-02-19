// Sistema de persistencia de usuarios
const fs = require('fs');
const USER_STATES_FILE = 'user_states.json';

// Función para guardar estados de usuarios
function guardarEstadosUsuarios() {
    try {
        const data = JSON.stringify(userStates, null, 2);
        fs.writeFileSync(USER_STATES_FILE, data);
        console.log('📁 Estados de usuarios guardados');
    } catch (error) {
        console.log('❌ Error guardando estados:', error.message);
    }
}

// Función para cargar estados de usuarios
function cargarEstadosUsuarios() {
    try {
        if (fs.existsSync(USER_STATES_FILE)) {
            const data = fs.readFileSync(USER_STATES_FILE, 'utf8');
            const loadedStates = JSON.parse(data);
            
            // Restaurar estados
            Object.keys(loadedStates).forEach(userId => {
                userStates[userId] = loadedStates[userId];
            });
            
            console.log(`📁 Estados cargados: ${Object.keys(userStates).length} usuarios`);
        }
    } catch (error) {
        console.log('❌ Error cargando estados:', error.message);
    }
}

// Guardar estados cada 5 minutos
setInterval(guardarEstadosUsuarios, 5 * 60 * 1000);

// Guardar al cerrar el servidor
process.on('SIGINT', () => {
    console.log('\n🔄 Guardando estados antes de cerrar...');
    guardarEstadosUsuarios();
    process.exit(0);
});

// Cargar estados al iniciar
cargarEstadosUsuarios();
