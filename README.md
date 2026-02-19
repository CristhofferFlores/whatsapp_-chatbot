# Chatbot Asistente para WhatsApp

Chatbot empresarial para responder dudas frecuentes de los trabajadores a través de WhatsApp.

## Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Iniciar el bot:
```bash
npm start
```

## Uso

1. Al iniciar, se mostrará un código QR en la terminal
2. Escanea el código QR con WhatsApp (menú > WhatsApp Web)
3. Una vez conectado, el bot responderá automáticamente

## Comandos Disponibles

- **hola** - Saludo inicial
- **ayuda** - Muestra opciones disponibles
- **horarios** - Horarios de trabajo
- **vacaciones** - Días festivos
- **contacto** - Información de contacto
- **adiós** - Despedida

## Características

- ✅ Respuestas automáticas
- ✅ Detección de palabras clave
- ✅ Manejo de preguntas no reconocidas
- ✅ Soporte 24/7
- ✅ Fácil de configurar

## Configuración

Para agregar nuevas respuestas, edita el objeto `respuestas` en `server.js`:

```javascript
const respuestas = {
    'nueva_palabra_clave': 'Tu respuesta aquí',
    // ...
};
```

## Notas

- Este bot usa `whatsapp-web.js` para pruebas
- Para producción, considera usar la API oficial de WhatsApp Business
- El bot necesita estar activo para responder mensajes
