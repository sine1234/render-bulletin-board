require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQLの設定
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// データベーステーブルの作成
async function createTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('テーブルの作成に成功しました');
  } catch (err) {
    console.error('テーブルの作成に失敗しました:', err);
  }
}

createTable();

// ミドルウェアの設定
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// ルート設定
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM posts ORDER BY created_at DESC');
    res.render('index', { posts: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('データベースエラー');
  }
});

app.post('/posts', async (req, res) => {
  const { title, content } = req.body;
  try {
    await pool.query(
      'INSERT INTO posts (title, content) VALUES ($1, $2)',
      [title, content]
    );
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('投稿エラー');
  }
});

app.listen(port, () => {
  console.log(`サーバーが http://localhost:${port} で起動しました`);
}); 