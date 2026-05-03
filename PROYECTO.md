# Hípica App — Registro del Proyecto

Aplicación web progresiva (PWA) para gestión de una finca hípica.
URL pública: `https://kikos2323-pixel.github.io/hipica-planner/`
Repositorio: `https://github.com/kikos2323-pixel/hipica-planner`

---

## Tecnologías utilizadas

| Tecnología | Uso |
|---|---|
| HTML / CSS / JavaScript vanilla | Base de la aplicación |
| Firebase Auth (Google) | Inicio de sesión |
| Cloud Firestore | Sincronización de datos entre dispositivos |
| Cloudinary | Almacenamiento de fotos de caballos |
| JSZip | Exportación de fotos en ZIP |
| Service Worker | Funcionamiento offline (PWA) |
| GitHub Pages | Hosting gratuito |

---

## Estructura de archivos

```
/
├── index.html          — Estructura HTML de toda la app
├── manifest.json       — Configuración PWA (iconos, nombre, colores)
├── sw.js               — Service Worker (caché offline)
├── PROYECTO.md         — Este archivo
├── css/
│   └── styles.css      — Todos los estilos y animaciones
├── js/
│   ├── app.js          — Lógica principal de la aplicación
│   └── firebase.js     — Configuración e importaciones de Firebase
└── icons/
    ├── icon-app.jpg    — Logo original de la app
    ├── icon-192.png    — Icono PWA 192x192
    ├── icon-512.png    — Icono PWA 512x512
    ├── icon-180.png    — Icono Apple Touch
    └── ui/             — Iconos SVG de la interfaz
```

---

## Firebase — Configuración

**Proyecto:** `app-adrian-hipica`
**Consola:** https://console.firebase.google.com

### Servicios activos
- **Authentication** — Google Sign-In
- **Firestore** — Base de datos principal

### Servicios NO activos
- **Storage** — No se pudo activar (proyecto supera cuota del plan Spark). Se usa Cloudinary en su lugar.

### Estructura de datos en Firestore

```
users/{uid}/data/main          — Datos principales del usuario
userProfiles/{uid}             — Perfil público del usuario
sharedHorses/{horseId}         — Fichas de caballos compartidas
appSettings/main               — Configuración global (admin)
```

### Reglas de Firestore (Firestore → Rules)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isOwner(userId) { return signedIn() && request.auth.uid == userId; }
    function appSettingsExists() {
      return exists(/databases/$(database)/documents/appSettings/main);
    }
    function isPrimaryAdmin() {
      return signedIn() && appSettingsExists()
        && get(/databases/$(database)/documents/appSettings/main).data.primaryAdminUid == request.auth.uid;
    }
    match /users/{userId}/data/{docId} {
      allow read, write: if isOwner(userId);
    }
    match /userProfiles/{userId} {
      allow read: if isOwner(userId) || isPrimaryAdmin();
      allow create, update: if isOwner(userId);
      allow delete: if false;
    }
    match /sharedHorses/{horseId} {
      allow read: if signedIn();
      allow create, update, delete: if signedIn()
        && request.resource.data.ownerUid == request.auth.uid;
    }
    match /appSettings/{docId} {
      allow read: if signedIn();
      allow create: if signedIn() && !appSettingsExists();
      allow update: if isPrimaryAdmin();
      allow delete: if false;
    }
  }
}
```

---

## Cloudinary — Configuración de fotos

**Cloud Name:** `dozjsexgz`
**Upload Preset:** `Hipica_photos` (modo Unsigned)
**Consola:** https://cloudinary.com

### Cómo funciona
- Las fotos de caballos se suben a Cloudinary al guardar una ficha
- Se guarda solo la URL (`https://res.cloudinary.com/...`) en Firestore
- Las fotos son accesibles desde cualquier dispositivo
- El `public_id` de cada foto sigue el formato: `hipica_horse_{horseId}`
- Esto permite reconstruir la URL si se pierde: `https://res.cloudinary.com/dozjsexgz/image/upload/hipica_horse_{horseId}`

### Migración automática al iniciar sesión
Al conectarse, la app ejecuta en orden:
1. `migrateOrLoadData` — carga datos desde Firestore
2. `migrateHorsePhotosToStorage` — sube fotos Base64 pendientes a Cloudinary
3. `recoverCloudinaryPhotos` — recupera URLs de caballos sin foto buscando en Cloudinary por ID

---

## Funcionalidades implementadas

### Gestión de jornadas
- Reloj de fichaje con inicio/pausa/fin
- Registro manual de horas
- Corrección del día actual
- Historial completo de jornadas
- Métricas: horas del mes, semana, promedio diario, días trabajados

### Tareas
- Crear, editar y eliminar tareas
- Prioridades: alta, media, baja
- Alarmas con notificaciones del navegador
- Estado: pendiente / completada

### Fichas de caballos
- Nombre, número, cuadra, paddock
- Foto sincronizada en la nube (Cloudinary)
- Coordenadas GPS de cuadra y paddock
- Notas, raciones de comida (mañana/mediodía/tarde)
- Observaciones pendientes por caballo
- Compartir ficha con otros usuarios
- Exportar información del caballo

### Observaciones
- **Obs. pendientes:** observaciones por caballo con estado completado
- **Obs. generales:** notas libres con tipos (normal, recordatorio, urgente, info) y alarmas
- Papelera de reciclaje para restaurar observaciones eliminadas

### Historial
- Registro de jornadas pasadas
- Papelera de elementos eliminados con opción de restaurar o borrar definitivamente

### Calendario
- Vista mensual con notas por día
- Navegación entre meses

### Sincronización entre dispositivos
- Login con Google
- Datos en Firestore, fotos en Cloudinary
- Migración automática de datos locales al primer login
- Botón de sincronización manual en la barra superior
- Banner de estado durante sincronización

### PWA (Aplicación instalable)
- Funciona offline (Service Worker)
- Instalable en móvil y escritorio
- Iconos PNG generados desde la foto del logo
- Banner de instalación en dispositivos compatibles

### Apariencia y temas
- Modo claro / oscuro
- 8 temas de color: Hípica, Bosque, Arena, Noche, Océano, Atardecer, Lavanda, Carbono
- Personalización de color primario, acento, transparencia y fondo
- Preferencias guardadas por usuario

### Micro-interacciones (rediseño UI)
- Efecto ripple en todos los botones
- Hover con elevación en cards y métricas
- Animación escalonada al cargar listas
- Glow en inputs al hacer foco
- Indicador animado en pestañas activas
- Scrollbar personalizada
- Badge "urgente" con pulso continuo
- Animaciones de entrada en modales y toasts
- Respeta `prefers-reduced-motion`

---

## Pendiente / No implementado

| Funcionalidad | Estado | Motivo |
|---|---|---|
| Firebase Storage | ❌ No disponible | El proyecto superó la cuota del plan Spark y no se pudo activar |
| Exportación ZIP de fotos | ✅ Implementado | Usa JSZip + Cloudinary URLs |
| Notificaciones push en background | ⚠️ Parcial | Solo funciona con la app abierta |
| Sincronización offline de fotos | ❌ No implementado | Requeriría IndexedDB adicional |

---

## Historial de cambios

### 2026-05-03
- Integración completa con Cloudinary para fotos de caballos
- Panel de progreso con barra animada durante la migración de fotos
- Recuperación automática de URLs de fotos perdidas (`recoverCloudinaryPhotos`)
- Escritura inmediata a Firestore tras migración (sin depender del debounce)
- Rediseño UI: micro-interacciones, ripple, hover animations
- 8 temas de color (añadidos Océano, Atardecer, Lavanda, Carbono)
- Mejora del sistema de errores en la migración de fotos

### Antes de 2026-05-03
- Estructura base de la aplicación (jornadas, tareas, caballos)
- Sistema de observaciones con dos sub-pestañas
- Papelera de reciclaje
- Integración Firebase Auth + Firestore
- Sistema de sincronización con debounce
- PWA: manifest, service worker, iconos PNG
- Login con Google, migración de datos locales a la nube
- Barra de botones superior: modo, instalar, sincronizar, usuario
- Logo de la app como icono PWA y marca en la barra lateral
- Sistema de temas con 4 presets iniciales
- Compartir fichas de caballos entre usuarios
- Panel de administración

---

*Este archivo se actualiza manualmente con cada sesión de cambios.*
