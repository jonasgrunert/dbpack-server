# MLE Development Environmant in Lively

This is the backend service to make the mle development system work. It works with websockets to communicate with the frontend.

![MLE IDE](./mle-ide.png)

### Installation

I recommend the installation using degit. This will create a folder called `dbpack-server`.

```
npx degit "jonasgrunert/dbpack-server" "dbpack-server"
```

If that does not work clone the repository. Next up you have to install the dependencies using yarn or npm and building and starting the server:

```bash
cd dbpack-server
# Yarn
yarn
yarn build
# Or npm
npm i
npm run build
# Run the server
node dist/index.ts
```

Now you may visit the [Lively Kernel](https://lively-kernel.org/lively4/lively4-core/start.html) and open the IDE via the context menu via `Tools > MLE IDE`. You may confirm the default URL in the popup and start your journey.

### Remarks

At the moment it connects to a default instance hosted by the HPI. This is configured in the frontend and may be changed in the future. For future workshops the big chunk of the implementation work lies in the dbpack folder, where a complete Packing Tool resides. The UI Pieces are fairly reusable as well as the server interactions. For a following seminar I would recommend leaning heavier into the lively-core.
