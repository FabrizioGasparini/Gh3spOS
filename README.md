# 🌐 Gh3spOS

**Gh3spOS** è un sistema operativo **web-based** creato con **React**, che simula un ambiente desktop moderno, dinamico e minimale.  
Pensato per sviluppatori, makers e appassionati di UI, offre un'esperienza fluida, con finestre, dock, animazioni e app personalizzate — tutto **direttamente nel browser**.

![Gh3spOS Preview](preview.png)

---

## ✨ Funzionalità principali

- 🪟 **Gestione finestre stile OS**  
  Drag & drop fluido, ridimensionamento, chiusura/apertura, stile vetro liquido (glass UI).

- 🧭 **Dock interattivo**  
  Barra inferiore con icone app, animazioni e apertura/chiusura finestre in stile sistema operativo.

- 🗂️ **File Manager simulato**  
  Esplora cartelle e file fittizi, utile per test e simulazioni all’interno dell’ambiente web.

- ⚙️ **App interne modulari**  
  Include app come notepad, impostazioni, preview file e altro. Tutto integrato con gestione finestre.

- 🎨 **UI animata con Framer Motion**  
  Transizioni fluide, effetti "blur" e interfaccia responsive con supporto a modalità chiara e scura (in sviluppo).

- 🧠 **Stato gestito localmente (niente Redux)**  
  Stato locale all'interno di ogni app per massima semplicità di sviluppo.

---

## 🛠️ Tecnologie usate

- [React](https://react.dev/)
- [TailwindCSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [React Router](https://reactrouter.com/) *(in integrazione)*
- [Lucide Icons](https://lucide.dev/)

---

## 🚧 Roadmap (prossime feature)

- 🌈 Temi personalizzati (dark/light + editor tema)
- 🔌 App Store interno per installare nuove app
- 💾 File system virtuale con persistenza (IndexedDB)
- 👨‍💻 Terminale interattivo con comandi Gh3sp
- 🔐 Sistema di login per utenti multipli

---

## ▶️ Come eseguire in locale

```bash
git clone https://github.com/FabrizioGasparini/gh3spos.git
cd gh3spos
npm install
npm run dev
```

> Requisiti: **Node.js 18+**, **npm** o **pnpm**

---

## 📄 Licenza

Distribuito con licenza **MIT**.  
Vedi il file `LICENSE` per maggiori dettagli.

---

> _Gh3spOS: più che un sistema operativo, un laboratorio creativo dentro il browser._  
> **Creato con 💙 da Fabri**
