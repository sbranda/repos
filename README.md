# Mis repos

App web para administrar mis repositorios de GitHub desde un solo lugar. Se publica en **https://sbranda.github.io/repos/**.

## Qué hace

- Lista todos tus repos (públicos y privados) con buscador y filtros por estado, visibilidad, lenguaje, antigüedad del último push y forks.
- Muestra el detalle de cada repo: ramas, PRs abiertos, issues abiertos y el resultado del último CI de la rama principal.
- Muestra si cada repo tiene sitio en GitHub Pages, con link directo, y permite activarlo, cambiar desde qué rama o carpeta se publica, o desactivarlo.
- Permite renombrar, cambiar la descripción, el sitio web y la visibilidad, y archivar o desarchivar.
- Acciones en lote sobre varios repos a la vez: archivar, desarchivar, hacer privados o públicos.
- Todo cambio pide confirmación antes de aplicarse. Borrar repos no está disponible a propósito.

## Instalarla como app (PWA)

La app se puede instalar en el celular o la computadora:

- **Chrome o Edge (Android, Windows, Mac, Linux):** tocá **Instalar app** en la barra de arriba, o el ícono de instalar en la barra de direcciones.
- **iPhone o iPad (Safari):** botón Compartir → **Agregar a pantalla de inicio**.

Instalada se abre en su propia ventana y carga aunque no haya conexión. Los datos de tus repos y el token nunca se guardan en caché: sin internet solo se ve la pantalla, y los cambios necesitan conexión.

## Cómo entrar

La app es estática y corre entera en tu navegador. Para hablar con GitHub usa un **token personal** que pegás al entrar:

1. Creá un [fine-grained token](https://github.com/settings/personal-access-tokens/new).
2. En **Repository access** elegí **All repositories**.
3. En **Permissions → Repository** dale **Administration: Read and write**, **Pages: Read and write** y **Actions**, **Issues** y **Pull requests: Read-only**.

El token queda guardado solo en tu navegador y se envía únicamente a `api.github.com`.

## Publicación

Cada push a `main` se publica solo con GitHub Actions (`.github/workflows/deploy.yml`). La primera vez hay que ir a
**Settings → Pages** del repo y en **Source** elegir **GitHub Actions**.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173/repos/
npm run build    # genera dist/
```

Stack: React 19, Vite y TypeScript, sin dependencias extra. La API de GitHub se llama con `fetch` desde `src/github.ts`.
