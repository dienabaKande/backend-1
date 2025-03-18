const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mysql = require("mysql2");
const fs = require("fs");
const crypto = require("crypto");
const csv = require("csv-parser");
const nodemailer = require("nodemailer");
const router = express.Router();
const app = express();
app.use(cors());
app.use(express.json());

// Connexion à MariaDB
const db = mysql.createConnection({
  host: "mysql-dienaba.alwaysdata.net",
  user: "dienaba_yacine",
  password: "passer123",
  database: "dienaba_parrainage",
});

db.connect((err) => {
  if (err) {
    console.error("Erreur de connexion à la base de données", err);
  } else {
    console.log("Connecté à MariaDB");
  }
});

// Configuration de multer pour l'upload
const upload = multer({ dest: "uploads/" });

/**
 * 🔹 Endpoint pour l'importation des électeurs via fichier CSV
 */
app.post("/api/upload-electeurs", upload.single("file"), (req, res) => {
  const filePath = req.file.path;
  const checksum = req.body.checksum;

 // Calculer le checksum du fichier
const fileBuffer = fs.readFileSync(filePath);
const fileChecksum = crypto.createHash("sha256").update(fileBuffer).digest("hex");
console.log("Calculated checksum: ", fileChecksum);
console.log("Expected checksum: ", checksum);

if (fileChecksum.toLowerCase() !== checksum) {
  return res.status(400).json({ error: "Le checksum du fichier ne correspond pas." });
}


  // Lire et valider le fichier CSV
  const results = [];
  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", () => {
      results.forEach((electeur) => {
        db.query(
          "INSERT INTO electeurstemporaires (cin, numero_electeur, nom, prenom, date_naissance, lieu_naissance, sexe, bureau_vote) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            electeur.cin,
            electeur.numero_electeur,
            electeur.nom,
            electeur.prenom,
            electeur.date_naissance,
            electeur.lieu_naissance,
            electeur.sexe,
            electeur.bureau_vote,
          ],
          (err) => {
            if (err) console.error("Erreur lors de l'insertion d'un électeur :", err);
          }
        );
      });
      res.json({ message: "Fichier uploadé et validé avec succès !", data: results });
    })
    .on("error", (err) => {
      res.status(500).json({ error: "Erreur lors de la lecture du fichier CSV." });
    });
});
router.get('/verifier', async (req, res) => {
    const { numeroElecteur } = req.query;
    if (!numeroElecteur) {
        return res.status(400).json({ error: "Le numéro de l'électeur est requis." });
    }

    try {
        db.query('SELECT * FROM candidats WHERE cin = ?', [numeroElecteur], (err, result) => {
            if (err) {
                return res.status(500).json({ error: "Erreur serveur." });
            }
            if (result.length === 0) {
                return res.status(404).json({ error: "Le candidat n'existe pas." });
            }
            res.json(result[0]);
        });
    } catch (error) {
        res.status(500).json({ error: "Erreur interne." });
    }
});

//** 🔹 Endpoint pour ajouter un candidat*/
app.post("/api/candidats", (req, res) => {
 const { numeroElecteur, email, telephone, parti, slogan, couleurs, url } = req.body;

 // Vérification des champs obligatoires
 if (!numeroElecteur || !email || !telephone) {
   return res.status(400).json({ error: "Veuillez remplir tous les champs obligatoires." });
 }

 // Vérifier si l'électeur existe avant de l'enregistrer comme candidat
 db.query("SELECT * FROM electeurs WHERE numero_electeur = ?", [numeroElecteur], (err, result) => {
   if (err) {
     console.error(err); // Ajouter un log d'erreur pour aider au débogage
     return res.status(500).json({ error: "Erreur serveur lors de la vérification de l'électeur." });
   }

   if (result.length === 0) {
     return res.status(404).json({ error: "L'électeur n'existe pas." });
   }

   // Vérifier si l'électeur est déjà enregistré comme candidat
   db.query("SELECT * FROM candidats WHERE cin = ?", [result[0].cin], (err, candidat) => {
     if (err) {
       console.error(err); // Ajouter un log d'erreur pour aider au débogage
       return res.status(500).json({ error: "Erreur serveur lors de la vérification du candidat." });
     }

     if (candidat.length > 0) {
       return res.status(400).json({ error: "Candidat déjà enregistré !" });
     }

     // Insérer dans la table candidats
     db.query(
       "INSERT INTO candidats (cin, email, telephone, parti_politique, slogan, couleurs_partis, url_page) VALUES (?, ?, ?, ?, ?, ?, ?)",
       [result[0].cin, email, telephone, parti, slogan, couleurs, url],
       (err) => {
         if (err) {
           console.error(err); // Ajouter un log d'erreur pour aider au débogage
           return res.status(500).json({ error: "Erreur d'enregistrement du candidat." });
         }

         return res.json({ success: true, message: "Candidat enregistré avec succès !" });
       }
     );
   });
 });
});
router.post('/enregistrer', async (req, res) => {
  const { cin, nom, prenom, date_naissance, email, telephone, parti_politique, slogan, photo, couleurs_partis, url_page, code_auth } = req.body;

  if (!cin || !nom || !prenom || !date_naissance || !email || !telephone) {
      return res.status(400).json({ error: "Tous les champs obligatoires doivent être remplis." });
  }

  try {
      db.query('SELECT * FROM candidats WHERE cin = ?', [cin], (err, result) => {
          if (err) return res.status(500).json({ error: "Erreur lors de la vérification du candidat." });

          if (result.length > 0) {
              return res.status(400).json({ error: "Candidat déjà enregistré." });
          }

          // Insérer un nouveau candidat
          db.query(
              'INSERT INTO candidats (cin, nom, prenom, date_naissance, email, telephone, parti_politique, slogan, photo, couleurs_partis, url_page, code_auth) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [cin, nom, prenom, date_naissance, email, telephone, parti_politique, slogan, photo, couleurs_partis, url_page, code_auth],
              (err, result) => {
                  if (err) return res.status(500).json({ error: "Erreur lors de l'enregistrement du candidat." });
                  res.status(201).json({ message: "Candidat enregistré avec succès !" });
              }
          );
      });
  } catch (error) {
      res.status(500).json({ error: "Erreur interne du serveur." });
  }
});

/**
 * 🔹 Endpoint pour enregistrer un parrain
 */
app.post("/api/parrains", (req, res) => {
  const { numeroElecteur, cin, nom, bureauVote, telephone, email } = req.body;

  db.query(
    "INSERT INTO parrains (numero_electeur, cin, nom, bureau_vote, telephone, email) VALUES (?, ?, ?, ?, ?, ?)",
    [numeroElecteur, cin, nom, bureauVote, telephone, email],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Parrain enregistré avec succès !" });
    }
  );
});

// Route pour enregistrer un parrain
app.post("/parrains/enregistrer", (req, res) => {
    const { numeroElecteur, cin, nom, bureauVote, telephone, email } = req.body;

    if (!numeroElecteur || !cin || !nom || !bureauVote || !telephone || !email) {
        return res.status(400).json({ message: "Tous les champs sont obligatoires !" });
    }

    const checkQuery = "SELECT * FROM parrains WHERE numeroElecteur = ? OR cin = ? OR telephone = ? OR email = ?";
    db.query(checkQuery, [numeroElecteur, cin, telephone, email], (err, result) => {
        if (err) {
            console.error("Erreur SQL :", err);
            return res.status(500).json({ message: "Erreur serveur" });
        }
        if (result.length > 0) {
            return res.status(400).json({ message: "Cet électeur est déjà enregistré !" });
        }

        const insertQuery = "INSERT INTO parrains (numeroElecteur, cin, nom, bureauVote, telephone, email) VALUES (?, ?, ?, ?, ?, ?)";
        db.query(insertQuery, [numeroElecteur, cin, nom, bureauVote, telephone, email], (err, result) => {
            if (err) {
                console.error("Erreur SQL lors de l'insertion :", err);
                return res.status(500).json({ message: "Erreur serveur" });
            }
            return res.status(201).json({ message: "Inscription réussie !" });
        });
    });
});
app.post("/api/parrains/verifier", (req, res) => {
  const { numeroElecteur, cin } = req.body;

  console.log("Vérification pour:", numeroElecteur, cin); // ✅ Debug

  db.query("SELECT * FROM electeurs WHERE numero_electeur = ? AND cin = ?", [numeroElecteur, cin], (err, result) => {
      if (err) return res.status(500).json({ error: "Erreur serveur." });
      if (result.length === 0) return res.json({ success: false, message: "Électeur non trouvé." });

      res.json({ success: true, electeur: result[0] });
  });
});


app.post("/api/parrains/authentifier", (req, res) => {
  const { numeroElecteur, codeAuth } = req.body;
  db.query("SELECT * FROM parrains WHERE numero_electeur = ? AND code_auth = ?", [numeroElecteur, codeAuth], (err, result) => {
      if (err) return res.status(500).json({ error: "Erreur serveur" });
      if (result.length === 0) return res.json({ success: false, message: "Code incorrect." });

      db.query("SELECT * FROM candidats", (err, candidats) => {
          if (err) return res.status(500).json({ error: "Erreur serveur" });
          res.json({ success: true, candidats });
      });
  });
});

const generateAuthCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // Génère un code à 6 chiffres
};

app.post("/api/parrains/generer-code", (req, res) => {
  const { numeroElecteur } = req.body;

  // Vérifier si l’électeur existe
  db.query("SELECT * FROM electeurs WHERE numero_electeur = ?", [numeroElecteur], (err, result) => {
      if (err) return res.status(500).json({ error: "Erreur serveur" });
      if (result.length === 0) return res.json({ success: false, message: "Électeur non trouvé." });

      // Générer un code unique
      const authCode = generateAuthCode();

      // Stocker le code dans la base de données
      db.query("UPDATE electeurs SET code_auth = ? WHERE numero_electeur = ?", [authCode, numeroElecteur], (err) => {
          if (err) return res.status(500).json({ error: "Erreur lors de la génération du code." });

          res.json({ success: true, message: "Code généré avec succès !", codeAuth: authCode });
      });
  });
});
const demanderCodeAuth = async () => {
  try {
      const response = await axios.post("http://localhost:5000/api/parrains/generer-code", {
          numeroElecteur: formData.numeroElecteur
      });

      if (response.data.success) {
          setMessage(`Votre code : ${response.data.codeAuth}`); // Affichage temporaire (à remplacer par un envoi SMS/Email)
      } else {
          setMessage(response.data.message);
      }
  } catch (error) {
      setMessage("Erreur lors de la demande du code.");
  }
};
app.post("/api/parrains/verifier-code", (req, res) => {
  const { numeroElecteur, codeAuth } = req.body;

  db.query("SELECT * FROM electeurs WHERE numero_electeur = ? AND code_auth = ?", [numeroElecteur, codeAuth], (err, result) => {
      if (err) return res.status(500).json({ error: "Erreur serveur" });
      if (result.length === 0) return res.json({ success: false, message: "Code incorrect." });

      res.json({ success: true, message: "Code valide.", electeur: result[0] });
  });
});

app.post("/parrains/demanderCode", (req, res) => {
    const { numeroElecteur, candidatId } = req.body;

    const codeValidation = Math.floor(10000 + Math.random() * 90000);

    const sql = "INSERT INTO parrainages (numero_electeur, candidat_id, code_validation) VALUES (?, ?, ?)";
    db.query(sql, [numeroElecteur, candidatId, codeValidation], (err) => {
        if (err) return res.status(500).json({ message: "Erreur serveur" });

        // Envoyer le code par e-mail / SMS (Nodemailer)
        const email = "exemple@email.com"; // Récupérer depuis la base électeurs

        let transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        let mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Code de validation de parrainage",
            text: `Votre code de validation est : ${codeValidation}`
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) console.log("Erreur envoi email :", err);
            else console.log("Email envoyé :", info.response);
        });

        res.json({ message: "Code envoyé !" });
    });
});
app.post("/parrains/valider", (req, res) => {
    const { numeroElecteur, codeValidation } = req.body;

    const sql = "SELECT * FROM parrainages WHERE numero_electeur = ? AND code_validation = ?";
    db.query(sql, [numeroElecteur, codeValidation], (err, result) => {
        if (err) return res.status(500).json({ message: "Erreur serveur" });
        if (result.length === 0) return res.status(400).json({ message: "Code incorrect" });

        res.json({ message: "Parrainage validé avec succès !" });
    });
});

/**
 * 🔹 Endpoint pour récupérer la liste des parrainages
 */
app.get("/api/parrainages", (req, res) => {
  db.query("SELECT * FROM parrainages", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

/**
 * 🔹 Endpoint pour gérer la période de parrainage
 */
app.post("/api/parrainage", (req, res) => {
  const { dateDebut, dateFin } = req.body;

  db.query(
    "INSERT INTO periode_parrainage (date_debut, date_fin, etat) VALUES (?, ?, 'ouverte')",
    [dateDebut, dateFin],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Période de parrainage enregistrée avec succès !" });
    }
  );
});

// 📌 Connexion du candidat avec email et code d’authentification
app.post("/api/candidats/login", (req, res) => {
    const { email, codeAuth } = req.body;
  
    db.query("SELECT * FROM candidats WHERE email = ? AND code_auth = ?", [email, codeAuth], (err, result) => {
      if (err) return res.status(500).json({ error: "Erreur serveur" });
  
      if (result.length === 0) {
        return res.status(401).json({ error: "Email ou code incorrect" });
      }
  
      res.json({ success: true, candidat: result[0] });
    });
  });
  
  // 📌 Récupérer l’évolution des parrainages pour un candidat
  app.get("/api/candidats/parrainages/:cin", (req, res) => {
    const { cin } = req.params;
  
    db.query(
      `SELECT DATE(date_parrainage) AS date, COUNT(*) AS total 
       FROM parrainages WHERE cin_candidat = ? 
       GROUP BY DATE(date_parrainage) ORDER BY date ASC`,
      [cin],
      (err, results) => {
        if (err) return res.status(500).json({ error: "Erreur serveur" });
  
        res.json(results);
      }
    );
  });
  app.get("/api/candidats/parrainages/:cin", (req, res) => {
    const { cin } = req.params;
  
    db.query(
      `SELECT DATE(date_parrainage) AS date, COUNT(*) AS total 
       FROM parrainages WHERE cin_candidat = ? 
       GROUP BY DATE(date_parrainage) ORDER BY date ASC`,
      [cin],
      (err, results) => {
        if (err) return res.status(500).json({ error: "Erreur serveur" });
  
        // Formatage des données
        const formattedResults = results.map(row => ({
          date: row.date,
          total: row.total
        }));
  
        res.json(formattedResults);
      }
    );
  });
  
  
// Lancer le serveur
const PORT = 5000;
app.listen(PORT, () => console.log(`✅ Serveur démarré sur http://localhost:${PORT}`));
