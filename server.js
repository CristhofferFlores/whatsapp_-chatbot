const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const fs = require('fs');

const app = express();
app.use(express.json());

// Sistema de persistencia de usuarios
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

// Sistema de folios
let folioCounter = 1;
const FOLIO_PREFIX = 'GT-RH-';

// Función para generar y guardar folio
function generarYGuardarFolio() {
    // Asegurar que folioCounter sea un número válido
    if (isNaN(folioCounter) || folioCounter < 1) {
        folioCounter = 1;
    }
    
    const folio = `${FOLIO_PREFIX}${String(folioCounter).padStart(6, '0')}`;
    folioCounter++;
    
    // Guardar en archivo local o en variable de entorno
    try {
        fs.writeFileSync('folio_counter.txt', folioCounter.toString());
    } catch (error) {
        console.log('No se pudo guardar el contador en archivo, usando memoria');
    }
    
    console.log(`📋 Folio generado: ${folio}`);
    return folio;
}

// Cargar contador al iniciar
function cargarFolioCounter() {
    try {
        if (fs.existsSync('folio_counter.txt')) {
            folioCounter = parseInt(fs.readFileSync('folio_counter.txt', 'utf8'));
        }
    } catch (error) {
        console.log('Iniciando contador de folios desde 1');
    }
}
cargarFolioCounter();

// Estado del usuario
const userStates = {};

// Sistema de temporizadores para usuarios inactivos
const userTimers = {};

// Sistema de monitoreo para experiencia de usuario
const systemStats = {
    totalUsers: 0,
    activeUsers: 0,
    pendingRequests: 0,
    activeTimers: 0,
    messagesProcessed: 0,
    foliosGenerated: 0,
    conversationsCompleted: 0,
    averageResponseTime: 0,
    startTime: new Date(),
    userActivity: {},
    errors: []
};

// Función para actualizar estadísticas
function updateStats(action, userId = null, data = {}) {
    switch(action) {
        case 'user_joined':
            systemStats.totalUsers++;
            systemStats.activeUsers++;
            systemStats.userActivity[userId] = { joined: new Date(), lastActivity: new Date() };
            break;
        case 'user_left':
            systemStats.activeUsers--;
            if (systemStats.userActivity[userId]) {
                delete systemStats.userActivity[userId];
            }
            break;
        case 'message_processed':
            systemStats.messagesProcessed++;
            if (userId && systemStats.userActivity[userId]) {
                systemStats.userActivity[userId].lastActivity = new Date();
            }
            break;
        case 'request_started':
            systemStats.pendingRequests++;
            break;
        case 'request_completed':
            systemStats.pendingRequests--;
            systemStats.foliosGenerated++;
            systemStats.conversationsCompleted++;
            break;
        case 'timer_set':
            systemStats.activeTimers++;
            break;
        case 'timer_cleared':
            systemStats.activeTimers--;
            break;
        case 'error':
            systemStats.errors.push({
                timestamp: new Date(),
                userId: userId,
                error: data.error,
                context: data.context
            });
            break;
    }
}

// Función para limpiar usuarios inactivos (más de 30 minutos)
function cleanupInactiveUsers() {
    const now = new Date();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutos
    
    Object.keys(systemStats.userActivity).forEach(userId => {
        const lastActivity = systemStats.userActivity[userId].lastActivity;
        if (now - lastActivity > inactiveThreshold) {
            // Limpiar usuario inactivo
            limpiarTemporizador(userId);
            delete userStates[userId];
            delete systemStats.userActivity[userId];
            systemStats.activeUsers--;
            console.log(`🧹 Usuario inactivo limpiado: ${userId}`);
        }
    });
}

// Ejecutar limpieza cada 10 minutos
setInterval(cleanupInactiveUsers, 10 * 60 * 1000);

// Función para limpiar temporizador de usuario
function limpiarTemporizador(userId) {
    if (userTimers[userId]) {
        clearTimeout(userTimers[userId].recordatorio);
        clearTimeout(userTimers[userId].cierre);
        delete userTimers[userId];
        updateStats('timer_cleared', userId);
    }
}

// Función para configurar temporizadores de inactividad
function configurarTemporizadorInactividad(userId) {
    // Limpiar temporizadores existentes
    limpiarTemporizador(userId);
    
    // Temporizador de recordatorio (5 minutos)
    userTimers[userId] = {
        recordatorio: setTimeout(() => {
            if (userStates[userId]) {
                const userName = getUserName(userId);
                client.sendMessage(userId, `🤖 Hola ${userName}, ¿sigues ahí?

💭 Estoy esperando tu respuesta para poder ayudarte.
📋 Si necesitas volver al menú principal, escribe "hola"
🚪 Si deseas terminar la conversación, escribe "adiós"

⏰ Tengo 5 minutos más de espera disponible`);
            }
        }, 5 * 60 * 1000), // 5 minutos
        
        cierre: setTimeout(() => {
            if (userStates[userId]) {
                const userName = getUserName(userId);
                client.sendMessage(userId, `🤖 Hola ${userName}, he notado que no has respondido.

📧 Gracias por comunicarte con Grupo Trebol
🌟 ¡Que tengas un excelente día!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 Estamos para servirte: Lunes a sábado 06:00 am -18:00 pm
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                
                // Limpiar estado del usuario
                delete userStates[userId];
                limpiarTemporizador(userId);
                updateStats('user_left', userId);
            }
        }, 10 * 60 * 1000) // 10 minutos totales
    };
    
    updateStats('timer_set', userId);
}

// Función para reiniciar temporizador (se usa en cada interacción)
function reiniciarTemporizadorInactividad(userId) {
    if (userStates[userId]) {
        configurarTemporizadorInactividad(userId);
    }
}

// Función para obtener nombre del usuario
function getUserName(userId) {
    return userStates[userId]?.name || 'Trebolito';
}

// Función para crear menú principal personalizado
function crearMenuPrincipal(userName) {
    return `🌟 MENÚ PRINCIPAL
🤖 ¡Hola ${userName}! Soy el asistente virtual de Grupo Trebol.
Gracias por comunicarte con nosotros.

Para poder ayudarte mejor, por favor selecciona una opción:

1️⃣ 📄 Constancias laborales
2️⃣ 💰 Pago de sueldos
3️⃣ 📅 Incidencias (faltas, permisos, vacaciones)
4️⃣ 🧾 Liquidaciones
5️⃣ 💼 Trabaja con nosotros
6️⃣ 💬 Otra consulta
7️⃣ 🚪 Terminar conversación

Escribe el número correspondiente.`;
}

// Función para crear menús secundarios
const menus = {
    constancias: `📄 CONSTANCIAS LABORALES
Selecciona el tipo de constancia:
1️⃣ Constancia simple (solo laboral)
2️⃣ Constancia con sueldo
3️⃣ Constancia para banco
4️⃣ Constancia para visa
5️⃣ Seguimiento de constancia solicitada
6️⃣ Volver al menú principal
7️⃣ 🚪 Terminar conversación`,
        
    sueldos: `💰 PAGO DE SUELDOS
Selecciona una opción:
1️⃣ Fecha de pago
2️⃣ No recibí mi pago
3️⃣ Pago incompleto
4️⃣ Error en mi boleta de pago
5️⃣ Cambio de cuenta bancaria
6️⃣ Solicitar boleta de pago
7️⃣ 🚪 Terminar conversación`,
        
    incidencias: `📅 INCIDENCIAS
Selecciona:
1️⃣ Reportar falta
2️⃣ Justificar falta
3️⃣ Solicitar permiso
4️⃣ Solicitar vacaciones
5️⃣ Descanso médico
6️⃣ Error en asistencia
7️⃣ 🚪 Terminar conversación`,
    
    liquidaciones: `🧾 LIQUIDACIONES
Selecciona:
1️⃣ Información sobre mi liquidación
2️⃣ Estatus de pago
3️⃣ Dudas sobre cálculo
4️⃣ Carta de recomendación
5️⃣ Volver al menú principal

7️⃣ 🚪 Terminar conversación`
};

// Función para manejar solicitudes que requieren datos
function manejarSolicitudConDatos(userId, tipoSolicitud, datosRequeridos, tiempoEntrega) {
    // Asegurar que userStates exista
    if (!userStates[userId]) {
        userStates[userId] = { menu: 'main', name: null };
    }
    
    userStates[userId].pendingRequest = {
        type: tipoSolicitud,
        data: {},
        required: datosRequeridos,
        deliveryTime: tiempoEntrega
    };
    
    console.log(`Solicitud pendiente creada para ${userId}:`, userStates[userId].pendingRequest);
    
    // Configurar temporizador de inactividad
    configurarTemporizadorInactividad(userId);
    
    let mensaje = `📝 ${tipoSolicitud.toUpperCase()}\n\n`;
    mensaje += `Por favor proporciona la siguiente información:\n`;
    
    datosRequeridos.forEach((dato, index) => {
        mensaje += `${index + 1}. ${dato}\n`;
    });
    
    if (tiempoEntrega) {
        mensaje += `\n⏳ Tiempo de entrega: ${tiempoEntrega}`;
    }
    
    mensaje += `\n\n📌 Puedes enviar todos los datos en un solo mensaje o uno por uno.`;
    mensaje += `\nCuando termines, escribe "listo" para generar tu folio.`;
    
    return mensaje;
}

// Función para procesar datos de solicitud
function procesarDatosSolicitud(userId, message) {
    const pending = userStates[userId].pendingRequest;
    if (!pending) return null;
    
    // Si el usuario dice "listo", generar folio y finalizar
    if (message.body.toLowerCase().trim() === 'listo') {
        const folio = generarYGuardarFolio();
        const userName = getUserName(userId);
        
        let respuesta = `✅ ¡Solicitud recibida, ${userName}!\n\n`;
        respuesta += `📌 Folio de seguimiento: ${folio}\n`;
        respuesta += `📋 Tipo: ${pending.type}\n`;
        
        if (Object.keys(pending.data).length > 0) {
            respuesta += `📄 Datos recibidos:\n`;
            Object.entries(pending.data).forEach(([key, value]) => {
                respuesta += `• ${key}: ${value}\n`;
            });
        }
        
        respuesta += `\n⏳ ${pending.deliveryTime || 'Procesando tu solicitud...'}`;
        respuesta += `\n\n📩 Nos comunicaremos contigo pronto.`;
        
        // Limpiar solicitud pendiente
        delete userStates[userId].pendingRequest;
        userStates[userId].menu = 'main';
        
        // Agregar mensaje de continuación
        respuesta += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        respuesta += `\n🤖 ¿Hay algo más en lo que pueda ayudarte, ${userName}?`;
        respuesta += `\n📋 Puedes seleccionar una opción del menú principal:`;
        
        respuesta += `\n1️⃣ 📄 Constancias`;
        respuesta += `\n2️⃣ 💰 Sueldos`;
        respuesta += `\n3️⃣ 📅 Incidencias`;
        respuesta += `\n4️⃣ 🧾 Liquidaciones`;
        respuesta += `\n5️⃣ 💼 Trabajo`;
        respuesta += `\n6️⃣ 💬 Otra consulta`;
        respuesta += `\n7️⃣ 🚪 Terminar conversación`;
        respuesta += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        
        return respuesta;
    }
    
    // Extraer datos del mensaje
    const msg = message.body.toLowerCase().trim();
    const originalMsg = message.body;
    let datosEncontrados = [];
    
    // Primero intentar detectar formato estructurado (con etiquetas)
    if (msg.includes('nombre completo:') || msg.includes('puesto de interés:') || 
        msg.includes('correo electrónico:') || msg.includes('teléfono de contacto:') ||
        msg.includes('cv actualizado:')) {
        
        // Procesar formato estructurado línea por línea
        const lineas = originalMsg.split('\n');
        
        for (const linea of lineas) {
            const lineaLower = linea.toLowerCase().trim();
            
            for (const required of pending.required) {
                const key = required.toLowerCase().replace(/[•:]/g, '').trim();
                
                if (lineaLower.includes(`${key}:`) || lineaLower.includes(`${key} :`)) {
                    const valor = linea.split(':')[1]?.trim() || '';
                    if (valor && !pending.data[required]) {
                        pending.data[required] = valor;
                        datosEncontrados.push(required);
                    }
                }
            }
        }
    }
    else {
        // Si no es formato estructurado, usar detección inteligente
        for (const required of pending.required) {
            const key = required.toLowerCase().replace(/[•:]/g, '').trim();
            
            // Búsqueda más inteligente de datos
            if ((required.includes('nombre') && msg.length > 3 && !msg.includes('folio') && !msg.includes('solicitud')) || 
                (required.includes('dni') && /\d{8}/.test(msg)) || 
                (required.includes('correo') && msg.includes('@')) ||
                (required.includes('teléfono') && /\d{9}/.test(msg)) ||
                (required.includes('empleado') && /\d{3,6}/.test(msg)) ||
                (required.includes('puesto') && msg.length > 4) ||
                (required.includes('banco') && (msg.includes('bcp') || msg.includes('bbva') || msg.includes('scotiabank') || msg.includes('interbank') || msg.includes('banco'))) ||
                (required.includes('fecha') && /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(msg)) ||
                (required.includes('motivo') && msg.length > 10) ||
                (required.includes('supervisor') && msg.length > 5) ||
                (required.includes('periodo') && msg.length > 5) ||
                (required.includes('concepto') && msg.length > 5) ||
                (required.includes('país') || required.includes('pais')) && msg.length > 3 ||
                (required.includes('trámite') || required.includes('tramite')) && msg.length > 5 ||
                (required.includes('cuenta') && /\d{10,20}/.test(msg)) ||
                (required.includes('horario') && msg.includes(':')) ||
                (required.includes('días') || required.includes('dias')) && /\d+/.test(msg) ||
                (required.includes('documento') && msg.length > 10) ||
                (required.includes('evidencia') && msg.length > 5) ||
                (required.includes('autorización') || required.includes('autorizacion')) && msg.length > 5 ||
                (required.includes('separación') || required.includes('separacion')) && msg.length > 5 ||
                (required.includes('ingreso') || required.includes('salida')) && msg.length > 5) {
                
                if (!pending.data[required]) {
                    pending.data[required] = originalMsg;
                    datosEncontrados.push(required);
                }
            }
        }
    }
    
    // Si encontramos datos, confirmarlos
    if (datosEncontrados.length > 0) {
        let respuesta = `✅ Información recibida:\n`;
        datosEncontrados.forEach(dato => {
            respuesta += `• ${dato}: ${pending.data[dato]}\n`;
        });
        
        const restantes = pending.required.length - Object.keys(pending.data).length;
        
        if (restantes > 0) {
            respuesta += `\n📋 Faltan ${restantes} datos:\n`;
            pending.required.forEach(req => {
                if (!pending.data[req]) {
                    respuesta += `• ${req}\n`;
                }
            });
            respuesta += `\nCuando termines, escribe "listo" para generar tu folio.`;
        } else {
            respuesta += `\n🎉 ¡Todos los datos completos! Escribe "listo" para generar tu folio.`;
        }
        
        return respuesta;
    }
    
    // Si no se identifica el dato, guardar como información adicional
    if (!pending.data.adicional) {
        pending.data.adicional = [];
    }
    pending.data.adicional.push(originalMsg);
    
    return `📝 Información adicional recibida: "${originalMsg}"\n\nCuando termines, escribe "listo" para generar tu folio.`;
}

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    console.log('QR Code recibido, escanea con WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('¡Bot de Grupo Trebol listo y conectado!');
});

client.on('message', async (message) => {
    // 🚫 FILTRO CRÍTICO: No responder a estados de WhatsApp
    if (message.isStatus) {
        console.log(`🚫 Ignorando estado de WhatsApp de ${message.from}: "${message.body}"`);
        return;
    }
    
    // 🚫 FILTRO: No responder a mensajes vacíos o solo emojis
    if (!message.body || message.body.trim().length === 0) {
        console.log(`🚫 Ignorando mensaje vacío de ${message.from}`);
        return;
    }
    
    // 🚫 FILTRO: No responder a mensajes de grupo sin mención directa
    if (message.from.includes('@g.us') && !message.mentionedIds && !message.body.toLowerCase().includes('@botgrupotrebol')) {
        console.log(`🚫 Ignorando mensaje de grupo sin mención: "${message.body}"`);
        return;
    }
    
    // 🚫 FILTRO: No responder a mensajes de broadcast
    if (message.from.includes('@broadcast')) {
        console.log(`🚫 Ignorando mensaje de broadcast de ${message.from}`);
        return;
    }
    
    // 🚫 FILTRO: No responder si es el propio bot
    if (message.fromMe) {
        console.log(`🚫 Ignorando mensaje propio del bot`);
        return;
    }
    
    const msg = message.body.toLowerCase().trim();
    const userId = message.from;
    const chat = await message.getChat();
    
    console.log(`✅ Mensaje válido de ${userId}: ${msg}`);
    
    // Actualizar estadísticas
    updateStats('message_processed', userId);
    
    // Inicializar estado si no existe
    if (!userStates[userId]) {
        userStates[userId] = { menu: 'welcome', name: null };
        updateStats('user_joined', userId);
    }
    
    const userName = getUserName(userId);
    let respuesta = '';
    
    try {
        // Reiniciar temporizador en CADA mensaje del usuario
        reiniciarTemporizadorInactividad(userId);
        
        // Verificar si es una imagen y está en contexto de "Trabaja con nosotros"
        if (message.hasMedia && userStates[userId].lastMenuOption === 'trabaja_con_nosotros') {
            const media = await message.downloadMedia();
            if (media && (media.mimetype.includes('image/') || media.mimetype.includes('jpeg') || media.mimetype.includes('png'))) {
                respuesta = `✅ ¡Gracias! He recibido tu captura de pantalla.

📋 Tu postulación ha sido registrada correctamente.
📧 Revisaremos tu perfil y nos comunicaremos contigo si hay vacantes disponibles.

🎉 ¡Gracias por tu interés en Grupo Trebol!

¿Hay algo más en lo que pueda ayudarte? Escribe "hola" para ver el menú principal.`;
                
                // Limpiar el estado especial
                delete userStates[userId].lastMenuOption;
                
                // Enviar respuesta y detener ejecución
                message.reply(respuesta);
                return;
            }
        }
        
        // Manejar respuestas del menú de boletas
        if (userStates[userId].menu === 'boletas_menu') {
            if (msg === '1') {
                respuesta = `📲 **OPCIÓN 1: Descargar App**

🎉 ¡Excelente elección! Nuestra app te ofrece:

✅ **Beneficios:**
• 📱 Acceso instantáneo a tus boletas
• 📊 Historial completo de pagos
• 🔔 Notificaciones de nuevos depósitos
• 📄 Descarga directa en PDF
• 💾 Guardado automático

📲 **Descarga desde Play Store:**
1. Busca: "Grupo Trebol Digital Docs" o ingresa al link :https://play.google.com/store/apps/details?id=com.agromas.digitaldocs.grupotrebol&pcampaignid=web_share
2. Instala la app
3. Regístrate con tu DNI (Para el usuario y contraseña)
4. ¡Listo para usar!


¿Necesitas ayuda con algo más? Escribe "hola" para volver al menú principal.`;
                
                userStates[userId].menu = 'main';
            }
            else if (msg === '2') {
                respuesta = `🍎 **OPCIÓN 2: Acceso Web para iOS**

🌐 **Ingresa a nuestro portal web:**
https://grupotrebol.digitaldocs.pe/

✅ **Desde aquí puedes:**
• 📄 Descargar tus boletas en PDF
• 📊 Consultar tu historial
• 📱 Actualizar tus datos
• 💾 Guardar documentos

📱 **Compatible con:**
• 🍎 iPhone y iPad
• 💻 Cualquier navegador web
• 📲 Tablets y celulares

Recuerda entrar con tu DNI, tanto como usuario y contraseña.

¿Necesitas ayuda con algo más? Escribe "hola" para volver al menú principal.`;
                
                userStates[userId].menu = 'main';
            }
            else if (msg === '3') {
                respuesta = manejarSolicitudConDatos(userId, 'Solicitud de Boleta de Pago', [
                    'Nombre completo',
                    'Número de DNI',
                    'Periodo solicitado'
                ], 'Te enviaremos el PDF a tu WhatsApp dentro de las proximas 24 horas.');
                
                userStates[userId].menu = 'main';
            }
            else {
                respuesta = `❌ Opción inválida. Por favor selecciona:
1️⃣ 📲 Descargar app
2️⃣ 🍎 Acceso web (iOS)
3️⃣ 📧 Enviar datos aquí`;
            }
            
            // Enviar respuesta y detener ejecución
            if (respuesta) {
                message.reply(respuesta);
                return;
            }
        }
        
        // Si hay una solicitud pendiente, procesar datos
        if (userStates[userId].pendingRequest) {
            console.log(`Procesando datos para solicitud pendiente de ${userId}:`, userStates[userId].pendingRequest);
            
            respuesta = procesarDatosSolicitud(userId, message);
            if (respuesta) {
                message.reply(respuesta);
                return;
            }
        }
        
        console.log(`Estado actual de ${userId}:`, userStates[userId]);
        console.log(`Mensaje recibido: "${msg}"`);
        
        // Sistema de bienvenida y captura de nombre
        if (userStates[userId].menu === 'welcome') {
            if (msg === 'hola' || msg === 'ola' || msg === 'hola trebolito' || 
                msg === 'hol' || msg === 'ohla' || msg === 'olah' || msg === 'oa' ||
                msg === 'hola si' || msg === 'hola buen dia' || msg === 'hola buenas tardes' ||
                msg === 'hola buenas noches' || msg === 'hola buen día' ||
                msg === 'buenos días' || msg === 'buenos dias' || msg === 'buen dia' || msg === 'buen día' ||
                msg === 'buenas tardes' || msg === 'buena tardes' || msg === 'buenas tardes' ||
                msg === 'buenas noches' || msg === 'buena noches' || msg === 'buenas noches' ||
                msg === 'buenas' || msg === 'saludos' || msg === 'hey' || msg === 'que tal') {
                
                // 🔄 Si ya tiene nombre, ir directamente al menú
                if (userStates[userId].name) {
                    userStates[userId].menu = 'main';
                    respuesta = crearMenuPrincipal(userStates[userId].name);
                } else {
                    respuesta = `🤖 Hola, soy Trebolito el asistente virtual de Grupo Trebol.
Gracias por comunicarte con nosotros.

Para poder ayudarte por favor indicame tu nombre completo`;
                }
            }
            else if (msg.length > 2 && !msg.includes('menu') && !msg.includes('ayuda') && !msg.includes('opción') && !msg.includes('opcion')) {
                // Capturar nombre del usuario
                userStates[userId].name = msg.charAt(0).toUpperCase() + msg.slice(1).toLowerCase();
                userStates[userId].menu = 'main';
                
                respuesta = `¡Mucho gusto, ${userStates[userId].name}! 👋

Ahora sí, vamos a ayudarte con lo que necesites.


Para poder ayudarte mejor, por favor selecciona una opción:

1️⃣ 📄 Constancias laborales
2️⃣ 💰 Pago de sueldos
3️⃣ 📅 Incidencias (faltas, permisos, vacaciones)
4️⃣ 🧾 Liquidaciones
5️⃣ 💼 Trabaja con nosotros
6️⃣ 💬 Otra consulta
7️⃣ 🚪 Terminar conversación

Escribe el número correspondiente.`;
            }
            else {
                respuesta = `🤖 Por favor, dime tu nombre para poder ayudarte mejor.
Solo necesito que me digas cómo te llamas y luego te mostraré el menú de opciones.

Ejemplo: "Juan", "María", "Carlos", etc.`;
            }
        }
        // Lógica de navegación de menús principales (usuario ya tiene nombre)
        else if (msg === 'hola' || msg === 'ola' || msg === 'hola trebolito') {
            userStates[userId].menu = 'main';
            respuesta = crearMenuPrincipal(userName);
        }
        else if (msg === '1' && userStates[userId].menu === 'main') {
            userStates[userId].menu = 'constancias';
            respuesta = menus.constancias;
        }
        else if (msg === '2' && userStates[userId].menu === 'main') {
            userStates[userId].menu = 'sueldos';
            respuesta = menus.sueldos;
        }
        else if (msg === '3' && userStates[userId].menu === 'main') {
            userStates[userId].menu = 'incidencias';
            respuesta = menus.incidencias;
        }
        else if (msg === '4' && userStates[userId].menu === 'main') {
            userStates[userId].menu = 'liquidaciones';
            respuesta = menus.liquidaciones;
        }
        else if (msg === '5' && userStates[userId].menu === 'main') {
            // Marcar que el usuario está en contexto de "Trabaja con nosotros"
            userStates[userId].lastMenuOption = 'trabaja_con_nosotros';
            
            respuesta = `💼 TRABAJA CON NOSOTROS

🎉 ¡Gracias por tu interés en unirte a Grupo Trebol!

📋 Para postularte, por favor completa nuestro formulario:
https://forms.gle/LMt7JanaZyq2dMwW6

📸 Una vez que completes el formulario, envíame una captura de pantalla de la confirmación de envío.

✅ Esto nos ayudará a procesar tu solicitud más rápido y mantener un registro organizado.

📧 Nos comunicaremos contigo si tu perfil coincide con nuestras vacantes disponibles.

¿Necesitas algo más? Escribe "hola" para volver al menú principal.`;
        }
        else if (msg === '6' && userStates[userId].menu === 'main') {
            respuesta = manejarSolicitudConDatos(userId, 'Otra consulta', [
                'Consulta detallada'
            ], null);
        }
        else if (msg === '7' && userStates[userId].menu === 'main') {
            // Limpiar temporizador de inactividad
            limpiarTemporizador(userId);
            
            respuesta = `🤖 ¡Hasta luego, ${userName}! Si necesitas más ayuda, no dudes en escribirme.

📧 Gracias por comunicarte con Grupo Trebol
🌟 ¡Que tengas un excelente día!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 Estamos para servirte: Lunes a sábado 06:00 am -18:00 pm
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        }
        // Submenú Constancias
        else if (userStates[userId].menu === 'constancias') {
            if (msg === '1') {
                respuesta = manejarSolicitudConDatos(userId, 'Constancia Simple', [
                    'Nombre completo',
                    'Número de empleado',
                    'Puesto',
                    'Correo electrónico'
                ], '24–48 horas hábiles');
            }
            else if (msg === '2') {
                respuesta = manejarSolicitudConDatos(userId, 'Constancia con Sueldo', [
                    'Nombre completo',
                    'Número de empleado',
                    'Últimos 3 recibos de nómina (PDF o foto)',
                    'Correo electrónico'
                ], '48 horas hábiles');
            }
            else if (msg === '3') {
                respuesta = manejarSolicitudConDatos(userId, 'Constancia para Banco', [
                    'Nombre del banco',
                    'Tipo de trámite (crédito, tarjeta, etc.)',
                    'Nombre completo',
                    'Número de empleado'
                ], '48 horas hábiles');
            }
            else if (msg === '4') {
                respuesta = manejarSolicitudConDatos(userId, 'Constancia para Visa', [
                    'País destino',
                    'Nombre completo',
                    'Número de empleado',
                    'Antigüedad aproximada',
                    'Correo electrónico'
                ], '3 días hábiles');
            }
            else if (msg === '5') {
                respuesta = manejarSolicitudConDatos(userId, 'Seguimiento de Constancia', [
                    'Fecha de solicitud',
                    'Tipo de constancia',
                    'Nombre completo'
                ], null);
            }
            else if (msg === '6') {
                userStates[userId].menu = 'main';
                respuesta = crearMenuPrincipal(userName);
            }
            else if (msg === '7') {
                respuesta = `🤖 ¡Hasta luego, ${userName}! Si necesitas más ayuda, no dudes en escribirme.

📧 Gracias por comunicarte con Grupo Trebol
🌟 ¡Que tengas un excelente día!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 Estamos para servirte: Lunes a sábado 06:00 am -18:00 pm
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
            }
            else {
                respuesta = '❌ Opción inválida. Por favor escribe el número correcto del menú de constancias.';
            }
        }
        // Submenú Sueldos
        else if (userStates[userId].menu === 'sueldos') {
            if (msg === '1') {
                respuesta = `📅 FECHA DE PAGO
Los pagos se realizan los días 15 y el ultimo día habil de cada mes.
Si la fecha cae en fin de semana o festivo, se paga el día hábil anterior.`;
            }
            else if (msg === '2') {
                respuesta = manejarSolicitudConDatos(userId, 'No recibí mi pago', [
                    'Nombre completo',
                    'Numero de DNI'
                ], 'RRHH revisará tu caso en un plazo máximo de 24 horas hábiles');
            }
            else if (msg === '3') {
                respuesta = manejarSolicitudConDatos(userId, 'Pago incompleto', [
                    'Nombre completo',
                    'Numero de DNI',
                    'Descripción del detalle'
                ], null);
            }
            else if (msg === '4') {
                respuesta = manejarSolicitudConDatos(userId, 'Error en mi boleta de pago', [
                    'Concepto incorrecto',
                    'Periodo',
                    'Evidencia si aplica'
                ], null);
            }
            else if (msg === '5') {
                respuesta = manejarSolicitudConDatos(userId, 'Cambio de cuenta bancaria', [
                    'Estado de cuenta reciente (no mayor a 2 meses)',
                    'N° de cuenta',
                    'DNI vigente (solo el número, no fotografía)'
                ], null);
            }
            else if (msg === '6') {
                userStates[userId].menu = 'boletas_menu';
                respuesta = `📱 SOLICITAR BOLETA DE PAGO

🎉 ¡Te damos la bienvenida a nuestra nueva app de Grupo Trebol!

📲 **OPCIÓN 1: Descargar nuestra app**
🍎 **OPCIÓN 2: Si eres usuario iOS o no puedes descargar el app**
📧 **OPCIÓN 3: Enviar tus datos aquí**


¿Cuál opción prefieres? Escribe el número (1, 2 o 3)`;
            }
            else if (msg === '7') {
                respuesta = `🤖 ¡Hasta luego, ${userName}! Si necesitas más ayuda, no dudes en escribirme.

📧 Gracias por comunicarte con Grupo Trebol
🌟 ¡Que tengas un excelente día!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 Estamos para servirte: Lunes a sábado 06:00 am -18:00 pm
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
            }
            else {
                respuesta = '❌ Opción inválida. Por favor escribe el número correcto del menú de sueldos.';
            }
        }
        // Submenú Incidencias
        else if (userStates[userId].menu === 'incidencias') {
            if (msg === '1') {
                respuesta = manejarSolicitudConDatos(userId, 'Reportar falta', [
                    'Fecha',
                    'Motivo',
                    'Supervisor directo'
                ], null);
            }
            else if (msg === '2') {
                respuesta = manejarSolicitudConDatos(userId, 'Justificar falta', [
                    'Justificante médico o documento',
                    'Fecha de ausencia',
                    'Numero de DNI'
                ], null);
            }
            else if (msg === '3') {
                respuesta = manejarSolicitudConDatos(userId, 'Solicitar permiso', [
                    'Fecha',
                    'Horario',
                    'Motivo',
                    'Autorización de jefe (si aplica)'
                ], 'Respuesta en 24 horas hábiles');
            }
            else if (msg === '4') {
                respuesta = manejarSolicitudConDatos(userId, 'Solicitar vacaciones', [
                    'Fechas solicitadas',
                    'Total de días',
                    'Autorización de jefe'
                ], null);
            }
            else if (msg === '5') {
                respuesta = manejarSolicitudConDatos(userId, 'Incapacidad médica', [
                    'Documento del ESSALUD',
                    'Fecha de inicio',
                    'Número de DNI'
                ], null);
            }
            else if (msg === '6') {
                respuesta = manejarSolicitudConDatos(userId, 'Error en asistencia', [
                    'Fecha',
                    'Tipo de error (entrada/salida)',
                    'Evidencia si aplica'
                ], null);
            }
            else if (msg === '7') {
                respuesta = `🤖 ¡Hasta luego, ${userName}! Si necesitas más ayuda, no dudes en escribirme.

📧 Gracias por comunicarte con Grupo Trebol
🌟 ¡Que tengas un excelente día!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 Estamos para servirte: Lunes a sábado 06:00 am -18:00 pm
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
            }
            else {
                respuesta = '❌ Opción inválida. Por favor escribe el número correcto del menú de incidencias.';
            }
        }
        // Submenú Liquidaciones
        else if (userStates[userId].menu === 'liquidaciones') {
            if (msg === '1') {
                respuesta = manejarSolicitudConDatos(userId, 'Información sobre liquidación', [
                    'Nombre completo',
                    'Fecha de baja',
                    'Motivo de separación'
                ], null);
            }
            else if (msg === '2') {
                respuesta = manejarSolicitudConDatos(userId, 'Estatus de pago de liquidación', [
                    'Fecha de baja',
                    'Nombre completo',
                    'Número de DNI'
                ], null);
            }
            else if (msg === '3') {
                respuesta = manejarSolicitudConDatos(userId, 'Dudas sobre cálculo de liquidación', [
                    'Concepto que deseas revisar',
                    'Periodo',
                    'Documento recibido'
                ], null);
            }
            else if (msg === '4') {
                respuesta = manejarSolicitudConDatos(userId, 'Carta de recomendación', [
                    'Nombre completo',
                    'Puesto desempeñado',
                    'Fecha de ingreso y salida',
                    'Correo electrónico'
                ], 'Entrega en 3 días hábiles');
            }
            else if (msg === '5') {
                userStates[userId].menu = 'main';
                respuesta = crearMenuPrincipal(userName);
            }
            else if (msg === '6') {
                respuesta = manejarSolicitudConDatos(userId, 'Carta de recomendación', [
                    'Nombre completo',
                    'Puesto desempeñado',
                    'Fecha de ingreso y salida',
                    'Correo electrónico'
                ], 'Entrega en 3 días hábiles');
            }
            else if (msg === '7') {
                respuesta = `🤖 ¡Hasta luego, ${userName}! Si necesitas más ayuda, no dudes en escribirme.

📧 Gracias por comunicarte con Grupo Trebol
🌟 ¡Que tengas un excelente día!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 Estamos para servirte: Lunes a sábado 06:00 am -18:00 pm
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
            }
            else {
                respuesta = '❌ Opción inválida. Por favor escribe el número correcto del menú de liquidaciones.';
            }
        }
        // Respuestas generales
        else if (msg.includes('ayuda') || msg === '0') {
            userStates[userId].menu = 'main';
            respuesta = crearMenuPrincipal(userName);
        }
        else if (msg.includes('gracias') || msg.includes('thanks')) {
            respuesta = `¡De nada, ${userName}! Estoy aquí para ayudarte. Si necesitas algo más, escribe "hola" para ver el menú principal.`;
        }
        else if (msg.includes('adiós') || msg.includes('adios') || msg.includes('chao') || 
                  msg.includes('no tengo más dudas') || msg.includes('no tengo mas dudas') || 
                  msg.includes('eso sería todo') || msg.includes('eso seria todo') || 
                  msg.includes('eso es todo') || msg.includes('seria todo') || 
                  msg.includes('gracias por la ayuda') || msg.includes('muchas gracias') ||
                  msg.includes('nos vemos') || msg.includes('hasta pronto') ||
                  msg.includes('saludos') || msg.includes('me voy')) {
            
            // Limpiar temporizador de inactividad
            limpiarTemporizador(userId);
            
            respuesta = `🤖 ¡Hasta luego, ${userName}! Si necesitas más ayuda, no dudes en escribirme.

📧 Gracias por comunicarte con Grupo Trebol
🌟 ¡Que tengas un excelente día!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 Estamos para servirte: Lunes a sábado 06:00 am -18:00 pm
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        }
        else {
            respuesta = `❌ No reconocí esa opción, ${userName}.
Por favor selecciona una opción del menú:

🌟 MENÚ PRINCIPAL:
1️⃣ 📄 Constancias laborales
2️⃣ 💰 Pago de sueldos
3️⃣ 📅 Incidencias (faltas, permisos, vacaciones)
4️⃣ 🧾 Liquidaciones
5️⃣ 💼 Trabaja con nosotros
6️⃣ 💬 Otra consulta

Escribe el número correspondiente.`;
        }
        
        // Enviar respuesta
        if (respuesta) {
            message.reply(respuesta);
        }
    } catch (error) {
        console.error(`Error procesando mensaje de ${userId}:`, error);
        updateStats('error', userId, { error: error.message, context: 'message_processing' });
        
        // Enviar mensaje de error amigable
        message.reply(`❌ Ha ocurrido un error inesperado, ${userName}. Por favor intenta nuevamente o escribe "hola" para reiniciar.`);
    }
});

// Endpoint de estado con monitoreo completo y visualización mejorada
app.get('/status', (req, res) => {
    const uptime = Date.now() - systemStats.startTime.getTime();
    const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
    const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    
    // Calcular tasa de éxito
    const totalRequests = systemStats.conversationsCompleted + systemStats.pendingRequests;
    const successRate = totalRequests > 0 ? 
        Math.round((systemStats.conversationsCompleted / totalRequests) * 100) : 100;
    
    // Formato HTML para mejor visualización
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🤖 Bot Grupo Trebol - Panel de Monitoreo</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(45deg, #2c3e50, #3498db);
            color: white;
            padding: 30px;
            text-align: center;
            position: relative;
        }
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .header .subtitle {
            font-size: 1.1em;
            opacity: 0.9;
        }
        .status-indicator {
            display: inline-block;
            width: 15px;
            height: 15px;
            border-radius: 50%;
            margin-left: 10px;
            animation: pulse 2s infinite;
        }
        .status-online { background-color: #4ade80; }
        .status-offline { background-color: #e74c3c; }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        .content {
            padding: 30px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 25px;
        }
        .stat-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            text-align: left;
        }
        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        }
        .stat-header {
            display: flex;
            align-items: center;
            margin-bottom: 12px;
            gap: 10px;
        }
        .stat-icon {
            font-size: 1.8em;
            min-width: 40px;
            text-align: center;
        }
        .stat-title {
            font-size: 1em;
            font-weight: 600;
            color: #2c3e50;
            margin: 0;
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #3498db;
            margin-bottom: 3px;
            line-height: 1;
        }
        .stat-description {
            color: #7f8c8d;
            font-size: 0.85em;
            margin: 0;
        }
        .performance-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
            margin-bottom: 30px;
        }
        .chart-container {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
        }
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #ecf0f1;
            border-radius: 4px;
            overflow: hidden;
            margin: 8px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #4ade80, #44bd32);
            border-radius: 4px;
            transition: width 0.5s ease;
        }
        .progress-label {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 5px;
            font-size: 0.9em;
        }
        .progress-label span:first-child {
            font-weight: 600;
            color: #2c3e50;
        }
        .progress-label span:last-child {
            font-weight: bold;
            color: #3498db;
        }
        .error-list {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
        }
        .error-item {
            padding: 15px;
            margin: 10px 0;
            background: #fee;
            border-left: 4px solid #e74c3c;
            border-radius: 6px;
        }
        .error-time {
            font-size: 0.85em;
            color: #7f8c8d;
            margin-top: 5px;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #7f8c8d;
            font-size: 0.9em;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: bold;
            margin-left: 10px;
        }
        .badge-success { background: #d4edda; color: #155724; }
        .badge-warning { background: #fff3cd; color: #856404; }
        .badge-danger { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Panel de Monitoreo</h1>
            <div class="subtitle">Bot Grupo Trebol - Asistente Virtual RRHH</div>
            <div style="margin-top: 15px;">
                <span class="status-indicator ${client.info ? 'status-online' : 'status-offline'}"></span>
                <span style="font-size: 1.2em; font-weight: bold;">
                    ${client.info ? 'CONECTADO' : 'DESCONECTADO'}
                </span>
                <span class="badge ${client.info ? 'badge-success' : 'badge-danger'}">
                    ${client.info ? 'Activo' : 'Inactivo'}
                </span>
            </div>
        </div>
        
        <div class="content">
            <!-- Estadísticas Principales -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-icon">👥</div>
                        <div class="stat-title">Usuarios Activos</div>
                    </div>
                    <div class="stat-value">${systemStats.activeUsers}</div>
                    <div class="stat-description">Conversaciones en curso</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-icon">📊</div>
                        <div class="stat-title">Total de Usuarios</div>
                    </div>
                    <div class="stat-value">${systemStats.totalUsers}</div>
                    <div class="stat-description">Desde el inicio</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-icon">📨</div>
                        <div class="stat-title">Mensajes Procesados</div>
                    </div>
                    <div class="stat-value">${systemStats.messagesProcessed}</div>
                    <div class="stat-description">Total de interacciones</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-icon">📋</div>
                        <div class="stat-title">Folios Generados</div>
                    </div>
                    <div class="stat-value">${systemStats.foliosGenerated}</div>
                    <div class="stat-description">Solicitudes completadas</div>
                </div>
            </div>
            
            <!-- Métricas de Rendimiento -->
            <div class="performance-grid">
                <div class="chart-container">
                    <h3 style="margin-bottom: 20px; color: #2c3e50;">📈 Métricas de Rendimiento</h3>
                    
                    <div style="margin-bottom: 20px;">
                        <div class="progress-label">
                            <span>Tasa de Éxito</span>
                            <span>${successRate}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${successRate}%"></div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <div class="progress-label">
                            <span>Conversaciones Completadas</span>
                            <span>${systemStats.conversationsCompleted}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${successRate}%"></div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <div class="progress-label">
                            <span>Solicitudes Pendientes</span>
                            <span>${systemStats.pendingRequests}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${systemStats.pendingRequests > 0 ? '100%' : '0%'}; background: #f39c12;"></div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <div class="progress-label">
                            <span>Temporizadores Activos</span>
                            <span>${systemStats.activeTimers}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${systemStats.activeTimers > 0 ? '100%' : '0%'}; background: #e67e22;"></div>
                        </div>
                    </div>
                </div>
                
                <div class="chart-container">
                    <h3 style="margin-bottom: 20px; color: #2c3e50;">⏱️ Información del Sistema</h3>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <div style="font-weight: 600; margin-bottom: 5px;">Tiempo de Operación</div>
                            <div style="font-size: 1.5em; color: #3498db; font-weight: bold;">${uptimeHours}h ${uptimeMinutes}m</div>
                        </div>
                        <div>
                            <div style="font-weight: 600; margin-bottom: 5px;">Próximo Folio</div>
                            <div style="font-size: 1.5em; color: #3498db; font-weight: bold;">GT-RH-${String(folioCounter).padStart(6, '0')}</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <div style="font-weight: 600; margin-bottom: 5px;">Promedio de Usuarios por Hora</div>
                        <div style="font-size: 1.3em; color: #2c3e50;">
                            ${systemStats.totalUsers > 0 ? Math.round(systemStats.totalUsers / (uptimeHours || 1)) : 0}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Errores Recientes -->
            ${systemStats.errors.length > 0 ? `
            <div class="error-list">
                <h3 style="margin-bottom: 20px; color: #e74c3c;">⚠️ Errores Recientes</h3>
                ${systemStats.errors.slice(-5).reverse().map(error => `
                    <div class="error-item">
                        <div style="font-weight: 600; color: #e74c3c;">${error.error}</div>
                        <div class="error-time">
                            🕐 ${new Date(error.timestamp).toLocaleString('es-PE')}
                            ${error.userId ? ` • Usuario: ${error.userId}` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            <div class="footer">
                <p>🤖 <strong>Bot Grupo Trebol</strong> - Sistema de Monitoreo en Tiempo Real</p>
                <p>📊 Última actualización: ${new Date().toLocaleString('es-PE')}</p>
                <p>📞 Servicio RRHH: Lunes a sábado 06:00 am - 18:00 pm</p>
            </div>
        </div>
    </div>
    
    <script>
        // Auto-refresh cada 30 segundos
        setTimeout(() => {
            window.location.reload();
        }, 30000);
    </script>
</body>
</html>`;
    
    res.send(html);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor web corriendo en puerto ${PORT}`);
    console.log(`Sistema de folios iniciado con prefijo ${FOLIO_PREFIX}`);
});

client.initialize();
