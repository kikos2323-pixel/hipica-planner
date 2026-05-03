# HÃ­pica App â€” Registro del Proyecto

AplicaciÃ³n web progresiva (PWA) para gestiÃ³n de una finca hÃ­pica.
URL pÃºblica: `https://kikos2323-pixel.github.io/hipica-planner/`
Repositorio: `https://github.com/kikos2323-pixel/hipica-planner`

---

## TecnologÃ­as utilizadas

| TecnologÃ­a | Uso |
|---|---|
| HTML / CSS / JavaScript vanilla | Base de la aplicaciÃ³n |
| Firebase Auth (Google) | Inicio de sesiÃ³n |
| Cloud Firestore | SincronizaciÃ³n de datos entre dispositivos |
| Cloudinary | Almacenamiento de fotos de caballos |
| JSZip | ExportaciÃ³n de fotos en ZIP |
| Service Worker | Funcionamiento offline (PWA) |
| GitHub Pages | Hosting gratuito |

---

## Estructura de archivos

```
/
â”œâ”€â”€ index.html          â€” Estructura HTML de toda la app
â”œâ”€â”€ manifest.json       â€” ConfiguraciÃ³n PWA (iconos, nombre, colores)
â”œâ”€â”€ sw.js               â€” Service Worker (cachÃ© offline)
â”œâ”€â”€ PROYECTO.md         â€” Este archivo
â”œâ”€â”€ css/
â”‚   â””â”€â”€ styles.css      â€” Todos los estilos y animaciones
â”œâ”€â”€ js/
â”‚   â”œâ”€â”€ app.js          â€” LÃ³gica principal de la aplicaciÃ³n
â”‚   â””â”€â”€ firebase.js     â€” ConfiguraciÃ³n e importaciones de Firebase
â””â”€â”€ icons/
    â”œâ”€â”€ icon-app.jpg    â€” Logo original de la app
    â”œâ”€â”€ icon-192.png    â€” Icono PWA 192x192
    â”œâ”€â”€ icon-512.png    â€” Icono PWA 512x512
    â”œâ”€â”€ icon-180.png    â€” Icono Apple Touch
    â””â”€â”€ ui/             â€” Iconos SVG de la interfaz
```

---

## Firebase â€” ConfiguraciÃ³n

**Proyecto:** `app-adrian-hipica`
**Consola:** https://console.firebase.google.com

### Servicios activos
- **Authentication** â€” Google Sign-In
- **Firestore** â€” Base de datos principal

### Servicios NO activos
- **Storage** â€” No se pudo activar (proyecto supera cuota del plan Spark). Se usa Cloudinary en su lugar.

### Estructura de datos en Firestore

```
users/{uid}/data/main          â€” Datos principales del usuario
userProfiles/{uid}             â€” Perfil pÃºblico del usuario
sharedHorses/{horseId}         â€” Fichas de caballos compartidas
appSettings/main               â€” ConfiguraciÃ³n global (admin)
```

### Reglas de Firestore (Firestore â†’ Rules)
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

## Cloudinary â€” ConfiguraciÃ³n de fotos

**Cloud Name:** `dozjsexgz`
**Upload Preset:** `Hipica_photos` (modo Unsigned)
**Consola:** https://cloudinary.com

### CÃ³mo funciona
- Las fotos de caballos se suben a Cloudinary al guardar una ficha
- Se guarda solo la URL (`https://res.cloudinary.com/...`) en Firestore
- Las fotos son accesibles desde cualquier dispositivo
- El `public_id` de cada foto sigue el formato: `hipica_horse_{horseId}`
- Esto permite reconstruir la URL si se pierde: `https://res.cloudinary.com/dozjsexgz/image/upload/hipica_horse_{horseId}`

### MigraciÃ³n automÃ¡tica al iniciar sesiÃ³n
Al conectarse, la app ejecuta en orden:
1. `migrateOrLoadData` â€” carga datos desde Firestore
2. `migrateHorsePhotosToStorage` â€” sube fotos Base64 pendientes a Cloudinary
3. `recoverCloudinaryPhotos` â€” recupera URLs de caballos sin foto buscando en Cloudinary por ID

---

## Funcionalidades implementadas

### GestiÃ³n de jornadas
- Reloj de fichaje con inicio/pausa/fin
- Registro manual de horas
- CorrecciÃ³n del dÃ­a actual
- Historial completo de jornadas
- MÃ©tricas: horas del mes, semana, promedio diario, dÃ­as trabajados

### Tareas
- Crear, editar y eliminar tareas
- Prioridades: alta, media, baja
- Alarmas con notificaciones del navegador
- Estado: pendiente / completada

### Fichas de caballos
- Nombre, nÃºmero, cuadra, paddock
- Foto sincronizada en la nube (Cloudinary)
- Coordenadas GPS de cuadra y paddock
- Notas, raciones de comida (maÃ±ana/mediodÃ­a/tarde)
- Observaciones pendientes por caballo
- Compartir ficha con otros usuarios
- Exportar informaciÃ³n del caballo

### Observaciones
- **Obs. pendientes:** observaciones por caballo con estado completado
- **Obs. generales:** notas libres con tipos (normal, recordatorio, urgente, info) y alarmas
- Papelera de reciclaje para restaurar observaciones eliminadas

### Historial
- Registro de jornadas pasadas
- Papelera de elementos eliminados con opciÃ³n de restaurar o borrar definitivamente

### Calendario
- Vista mensual con notas por dÃ­a
- NavegaciÃ³n entre meses

### SincronizaciÃ³n entre dispositivos
- Login con Google
- Datos en Firestore, fotos en Cloudinary
- MigraciÃ³n automÃ¡tica de datos locales al primer login
- BotÃ³n de sincronizaciÃ³n manual en la barra superior
- Banner de estado durante sincronizaciÃ³n

### PWA (AplicaciÃ³n instalable)
- Funciona offline (Service Worker)
- Instalable en mÃ³vil y escritorio
- Iconos PNG generados desde la foto del logo
- Banner de instalaciÃ³n en dispositivos compatibles

### Apariencia y temas
- Modo claro / oscuro
- 8 temas de color: HÃ­pica, Bosque, Arena, Noche, OcÃ©ano, Atardecer, Lavanda, Carbono
- PersonalizaciÃ³n de color primario, acento, transparencia y fondo
- Preferencias guardadas por usuario

### Micro-interacciones (rediseÃ±o UI)
- Efecto ripple en todos los botones
- Hover con elevaciÃ³n en cards y mÃ©tricas
- AnimaciÃ³n escalonada al cargar listas
- Glow en inputs al hacer foco
- Indicador animado en pestaÃ±as activas
- Scrollbar personalizada
- Badge "urgente" con pulso continuo
- Animaciones de entrada en modales y toasts
- Respeta `prefers-reduced-motion`

---

## Pendiente / No implementado

| Funcionalidad | Estado | Motivo |
|---|---|---|
| Firebase Storage | âŒ No disponible | El proyecto superÃ³ la cuota del plan Spark y no se pudo activar |
| ExportaciÃ³n ZIP de fotos | âœ… Implementado | Usa JSZip + Cloudinary URLs |
| Notificaciones push en background | âš ï¸ Parcial | Solo funciona con la app abierta |
| SincronizaciÃ³n offline de fotos | âŒ No implementado | RequerirÃ­a IndexedDB adicional |

---

## Historial de cambios

### 2026-05-03
- IntegraciÃ³n completa con Cloudinary para fotos de caballos
- Panel de progreso con barra animada durante la migraciÃ³n de fotos
- RecuperaciÃ³n automÃ¡tica de URLs de fotos perdidas (`recoverCloudinaryPhotos`)
- Escritura inmediata a Firestore tras migraciÃ³n (sin depender del debounce)
- RediseÃ±o UI: micro-interacciones, ripple, hover animations
- 8 temas de color (aÃ±adidos OcÃ©ano, Atardecer, Lavanda, Carbono)
- Mejora del sistema de errores en la migraciÃ³n de fotos

### Antes de 2026-05-03
- Estructura base de la aplicaciÃ³n (jornadas, tareas, caballos)
- Sistema de observaciones con dos sub-pestaÃ±as
- Papelera de reciclaje
- IntegraciÃ³n Firebase Auth + Firestore
- Sistema de sincronizaciÃ³n con debounce
- PWA: manifest, service worker, iconos PNG
- Login con Google, migraciÃ³n de datos locales a la nube
- Barra de botones superior: modo, instalar, sincronizar, usuario
- Logo de la app como icono PWA y marca en la barra lateral
- Sistema de temas con 4 presets iniciales
- Compartir fichas de caballos entre usuarios
- Panel de administraciÃ³n

---

*Este archivo se actualiza manualmente con cada sesiÃ³n de cambios.*

### 2026-05-04
- Corregida la recuperacion de fotos de caballos entre dispositivos
- La fusion nube + copia local ya no pisa una foto valida de Cloudinary con una ficha local antigua sin foto
- recoverCloudinaryPhotos ahora guarda tambien la copia local actualizada tras reconstruir URLs deterministas
- applyDataFromObject refresca la copia local para evitar volver a cargar versiones obsoletas en el siguiente inicio

