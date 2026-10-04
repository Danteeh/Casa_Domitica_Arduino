# Compilar el APK en la nube (GitHub Actions)

No necesitas instalar nada en tu PC. GitHub compila el APK en sus servidores
y te lo deja como archivo descargable.

## Que hace el workflow

El archivo `.github/workflows/build-apk.yml` corre esto en un servidor Ubuntu
de GitHub cada vez que subes codigo:

1. Instala Node 20, Java JDK 17 y el Android SDK.
2. `npm install` (baja Capacitor y el plugin Bluetooth).
3. `npx cap add android` (genera el proyecto Android).
4. `node scripts/patch-manifest.js` (agrega los permisos Bluetooth al manifest).
5. `npx cap sync android` (copia `www/` y los plugins).
6. `./gradlew assembleDebug` (compila el APK).
7. Sube el APK como "artifact" descargable.

Por eso la carpeta `android/` esta en `.gitignore`: NO la subes, el CI la
regenera desde cero cada vez. Tu solo mantienes `www/`.

---

## Paso a paso (primera vez)

### 1. Crea una cuenta en GitHub (si no tienes)

https://github.com -> Sign up. Es gratis y Actions es gratis para repos
publicos.

### 2. Crea un repositorio vacio

En GitHub: boton **New** (o https://github.com/new).
- Nombre: `casa-domotica` (el que quieras).
- Publico o privado, da igual (Actions funciona en ambos; en privado tienes
  2000 minutos gratis/mes, mas que suficiente).
- NO marques "Add a README" (ya tienes uno).
- Crea el repo. GitHub te mostrara una pagina con comandos.

### 3. Sube tu proyecto

Necesitas **git** instalado (https://git-scm.com/download/win, ~50 MB, es muy
ligero). Abre PowerShell en la carpeta del proyecto:

```powershell
cd "E:\Casa Do"
git init
git add .
git commit -m "Casa domotica: app Capacitor + firmware + CI"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/casa-domotica.git
git push -u origin main
```

Reemplaza `TU_USUARIO` por tu usuario de GitHub. En el primer `push` te pedira
iniciar sesion (se abre una ventana del navegador).

### 4. El build arranca solo

En cuanto subes a `main`, el workflow se dispara. Ve a tu repo en GitHub ->
pestana **Actions** -> veras "Build Android APK" corriendo (circulo amarillo).
Tarda ~3-5 minutos. Cuando termine en verde:

1. Haz clic en la ejecucion.
2. Abajo, en **Artifacts**, descarga **casa-domotica-apk**.
3. Es un `.zip` -> descomprimelo -> dentro esta `app-debug.apk`.

### 5. Instala en el telefono

Pasa `app-debug.apk` al telefono (cable, Drive, WhatsApp a ti mismo...) y
abrelo. Android pedira permitir "instalar apps de origen desconocido" -> acepta.

---

## Cada vez que cambies algo (siguientes veces)

Solo subes los cambios y el APK se regenera:

```powershell
cd "E:\Casa Do"
git add .
git commit -m "describe tu cambio"
git push
```

Vuelve a Actions, espera el verde, descarga el nuevo APK.

Tambien puedes lanzarlo a mano sin cambiar codigo: Actions -> Build Android APK
-> **Run workflow**.

---

## Si el build falla (circulo rojo)

Abre la ejecucion en Actions, haz clic en el paso rojo y copia el error. El
punto que mas suele fallar la primera vez es la version de Gradle vs el plugin;
si pasa, pegame el log y lo ajusto. El workflow ya corre con `--stacktrace`
para que el error salga completo.
