import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import bodyParser from 'body-parser'
import drivelist from 'drivelist'
import mime from 'mime-types';
import WebSocket, { WebSocketServer } from "ws";
import { Client } from "ssh2";

const app = express()
const PORT = 3001

app.use(cors())
app.use(bodyParser.json())

// FILE MANAGER
const baseDir = "C:"

// 🔍 Endpoint per leggere il contenuto di una cartella (con info avanzate)
app.get('/files', (req, res) => {
  let requestedPath = req.query.path || 'C:/'
  if(requestedPath.startsWith(".")) return res.status(500).json({ error: "no such file or directory" })
  if(requestedPath.endsWith(":")) requestedPath += "/"
  const fullPath = path.resolve(requestedPath)

  fs.readdir(fullPath, { withFileTypes: true }, async (err, entries) => {
    if (err) return res.status(500).json({ error: err.message })

    const files = await Promise.all(entries.map(async entry => {
        const fullEntryPath = path.join(fullPath, entry.name)
        try {
            const stats = await fs.promises.stat(fullEntryPath)
            return {
              name: entry.name,
              type: entry.isDirectory() ? 'folder' : 'file',
              size: entry.isDirectory() ? null : stats.size,
              modifiedAt: stats.mtime,
              extension: path.extname(entry.name)
            }
        } catch (err) {
            //console.warn(`Impossibile accedere a ${entry.name}: ${err.message}`)
            return null // ignora questo file
        }
    }))
      res.json(files.filter(f => f !== null))

  })
})

// ✏️ Rinomina file o cartella
app.post('/rename', (req, res) => {
  const { oldPath, newPath } = req.body
  const fullOldPath = path.resolve(baseDir, oldPath)
  const fullNewPath = path.resolve(baseDir, newPath)

  fs.rename(fullOldPath, fullNewPath, err => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ success: true })
  })
})

// 🗑️ Elimina file o cartella
app.post('/delete', (req, res) => {
  const { targetPath } = req.body
  const fullPath = path.resolve(baseDir, targetPath)

  fs.stat(fullPath, (err, stats) => {
    if (err) return res.status(500).json({ error: err.message })

    if (stats.isDirectory()) {
      fs.rm(fullPath, { recursive: true, force: true }, err => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ success: true })
      })
    } else {
      fs.unlink(fullPath, err => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ success: true })
      })
    }
  })
})

// ✂️ Copia file o cartella
app.post('/copy', async (req, res) => {
  const { sourcePath, destinationPath } = req.body
  const src = path.resolve(baseDir, sourcePath)
  const dest = path.resolve(baseDir, destinationPath)

  const copyRecursive = async (src, dest) => {
    const stats = await fs.promises.stat(src)
    if (stats.isDirectory()) {
      await fs.promises.mkdir(dest, { recursive: true })
      const entries = await fs.promises.readdir(src)
      for (const entry of entries) {
        await copyRecursive(path.join(src, entry), path.join(dest, entry))
      }
    } else {
      await fs.promises.copyFile(src, dest)
    }
  }

  try {
    await copyRecursive(src, dest)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ✂️ Taglia (sposta file o cartella)
app.post('/move', (req, res) => {
  const { sourcePath, destinationPath } = req.body
  const src = path.resolve(baseDir, sourcePath)
  const dest = path.resolve(baseDir, destinationPath)

  fs.rename(src, dest, err => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ success: true })
  })
})

app.get('/drives', async (req, res) => {
    try {
      const drives = await drivelist.list()
  
      // Mappiamo i drive nel formato che vuoi
      const result = drives.map(drive => {
        return {
          name: drive.mountpoints.length > 0 ? drive.mountpoints[0].path.replace("\\", "") : '', // es. "C:"
          label: drive.description || '', // la descrizione del drive (etichetta)
          type: drive.isRemovable ? 'removable' :
                drive.isSystem ? 'system' :
                drive.isVirtual ? 'virtual' :
                'fixed',
          size: drive.size
        }
      })
  
      res.json(result)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
})
  
app.get('/read', async (req, res) => {
  const { path: filePath } = req.query;

  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'Percorso file non valido' });
  }

  const fullPath = path.resolve(baseDir, filePath);

  try {
    const stats = await fs.promises.stat(fullPath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Il percorso specificato è una cartella' });
    }

    const buffer = await fs.promises.readFile(fullPath);
    const mimeType = mime.lookup(fullPath) || 'application/octet-stream';

    if (mimeType.startsWith('text/')) {
      return res.json({ type: 'text', content: buffer.toString('utf-8') });
    }

    if (mimeType.startsWith('image/')) {
      const base64 = buffer.toString('base64');
      return res.json({
        type: 'image',
        content: `data:${mimeType};base64,${base64}`
      });
    }

    if (mimeType.startsWith('application/mp4')) {
      const base64 = buffer.toString('base64');
      return res.json({
        type: 'video',
        content: `data:video/mp4;base64,${base64}`
      });
    }

    if (mimeType === 'application/pdf') {
      const base64 = buffer.toString('base64');
      return res.json({
        type: 'pdf',
        content: `data:${mimeType};base64,${base64}`
      });
    }

    // Tipo sconosciuto o non gestito (eseguibili, archivi, ecc.)
    return res.json({ type: 'other', content: buffer.toString('base64') });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const server = app.listen(PORT, () => {
  console.log(`📂 File Manager backend attivo su http://localhost:${PORT}`)
})


// WEB SOCKET
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  const ssh = new Client();

  ssh
    .on("ready", () => {
      console.log("✅ Connessione SSH riuscita");

      ssh.shell((err, stream) => {
        if (err) return ws.send(`Errore: ${err.message}`);

        // Dati da SSH → WebSocket
        stream.on("data", (data) => {
          ws.send(JSON.stringify({ type: "output", data: data.toString() }));
        });

        // Dati da WebSocket → SSH
        ws.on("message", (msg) => {
          try {
            const parsed = JSON.parse(msg.toString());
            if (parsed.type === "input") {
              stream.write(parsed.data); // Scrive solo il carattere
            }
          } catch (err) {
            console.error("❌ Errore parsing input:", err);
          }
        });
      });
    })
    .on("close", () => {
      console.log("❌ Connessione SSH chiusa");
      ws.close();
    })
    .on("error", (err) => {
      console.error("❗ Errore SSH:", err.message);
      ws.send(`Errore: ${err.message}`);
      ws.close();
    })
    .connect({
      host: "192.168.1.80",
      port: 22,
      username: "gaspa",
      password: "2010081", 
    });
});
