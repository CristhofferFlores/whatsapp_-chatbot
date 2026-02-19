# 🌐 Despliegue en Render - Bot Grupo Trebol

## 📋 Requisitos previos
- Cuenta en GitHub con el código del bot
- Cuenta en Render.com
- Archivos ya configurados para producción

## 🚀 Pasos para desplegar

### 1️⃣ Subir a GitHub
```bash
git init
git add .
git commit -m "Bot Grupo Trebol listo para producción"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

### 2️⃣ Configurar en Render
1. **Ir a** [render.com](https://render.com)
2. **Crear cuenta** o iniciar sesión
3. **Hacer clic** en "New +"
4. **Seleccionar** "Web Service"
5. **Conectar GitHub** (Authorize)
6. **Seleccionar repositorio** del bot
7. **Configurar servicio:**

#### ⚙️ Configuración del servicio:
- **Name**: `bot-grupo-trebol`
- **Region**: `Oregon (US West)` (la más económica)
- **Branch**: `main`
- **Root Directory**: `.`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `node server.js`

### 3️⃣ Variables de entorno
En "Environment" agregar:
```
NODE_ENV=production
PORT=3000
```

### 4️⃣ Desplegar
1. **Hacer clic** en "Create Web Service"
2. **Esperar** el despliegue (2-3 minutos)
3. **Ver logs** para verificar funcionamiento

## 📱 Configuración de WhatsApp

### 🔧 Para producción en Render:
1. **Escanear QR** desde los logs de Render
2. **Guardar sesión** (dura ~24 horas)
3. **Para persistencia**: Configurar número de negocio

## 💰 Costos

### 🆓 Plan gratuito:
- ✅ **750 horas/mes** de uso
- 📱 **Suficiente para bot 24/7**
- 🔄 **Reinicios automáticos**
- 📊 **Logs básicos**

### 💳 Plan pago ($7/mes):
- ✅ **Uso ilimitado**
- ⚡ **Rendimiento superior**
- 📊 **Logs avanzados**
- 🔒 **SSL incluido**

## 🎯 URL del bot
Una vez desplegado, tu bot estará en:
```
https://bot-grupo-trebol.onrender.com
```

## 📊 Panel de monitoreo
```
https://bot-grupo-trebol.onrender.com/status
```

## 🔧 Solución de problemas

### 🚫 Si el bot se desconecta:
1. **Ver logs** en Render dashboard
2. **Reescanear QR** si es necesario
3. **Verificar variables** de entorno

### 📱 Si no responde:
1. **Verificar que** esté "Live" en Render
2. **Revisar logs** de errores
3. **Verificar conexión** a WhatsApp

## 🎯 Ventajas de Render
- 🌐 **CDN global** - rápido en cualquier país
- 🔄 **Auto-deploy** con cada push a GitHub
- 📊 **Monitoreo en tiempo real**
- 🔒 **SSL gratuito** incluido
- 📱 **Compatible con WhatsApp Web**
