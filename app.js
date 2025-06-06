require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 削除用パスワード
const DELETE_PASSWORD = 'ntxareed';

// PostgreSQLの設定
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// データベース接続テスト
pool.connect((err, client, release) => {
  if (err) {
    console.error('データベース接続エラー:', err.message);
    console.error('DATABASE_URL:', process.env.DATABASE_URL ? '設定されています' : '設定されていません');
    console.error('NODE_ENV:', process.env.NODE_ENV);
  } else {
    console.log('データベースに正常に接続しました');
    release();
  }
});

// データベーステーブルの作成
async function createTables() {
  try {
    // 投稿テーブル
    await pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 返信テーブル
    await pool.query(`
      CREATE TABLE IF NOT EXISTS replies (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('テーブルの作成に成功しました');
  } catch (err) {
    console.error('テーブルの作成に失敗しました:', err.message);
    console.error('エラーの詳細:', err);
  }
}

createTables();

// ミドルウェアの設定
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(express.json()); // JSON解析用ミドルウェアを追加

// ルート設定
app.get('/', async (req, res) => {
  try {
    // 投稿と返信を取得
    const result = await pool.query(`
      SELECT 
        p.id,
        p.title,
        p.content,
        p.created_at,
        COALESCE(json_agg(
          json_build_object(
            'id', r.id,
            'content', r.content,
            'created_at', r.created_at
          ) ORDER BY r.created_at
        ) FILTER (WHERE r.id IS NOT NULL), '[]') as replies
      FROM posts p
      LEFT JOIN replies r ON p.id = r.post_id
      GROUP BY p.id, p.title, p.content, p.created_at
      ORDER BY p.created_at DESC
    `);
    
    res.render('index', { posts: result.rows });
  } catch (err) {
    console.error('データベースクエリエラー:', err.message);
    console.error('エラーの詳細:', err);
    res.status(500).render('index', { 
      posts: [],
      error: 'データベースエラーが発生しました。しばらく待ってから再度お試しください。'
    });
  }
});

// 新規投稿
app.post('/posts', async (req, res) => {
  const { title, content } = req.body;
  try {
    await pool.query(
      'INSERT INTO posts (title, content) VALUES ($1, $2)',
      [title, content]
    );
    res.redirect('/');
  } catch (err) {
    console.error('投稿エラー:', err.message);
    console.error('エラーの詳細:', err);
    res.status(500).render('index', { 
      posts: [],
      error: '投稿に失敗しました。しばらく待ってから再度お試しください。'
    });
  }
});

// 返信を追加
app.post('/posts/:postId/replies', async (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;
  try {
    await pool.query(
      'INSERT INTO replies (post_id, content) VALUES ($1, $2)',
      [postId, content]
    );
    res.redirect('/');
  } catch (err) {
    console.error('返信エラー:', err.message);
    console.error('エラーの詳細:', err);
    res.status(500).render('index', { 
      posts: [],
      error: '返信に失敗しました。しばらく待ってから再度お試しください。'
    });
  }
});

// スレッドを削除
app.delete('/posts/:postId', async (req, res) => {
  const { postId } = req.params;
  const { password } = req.body;

  if (password !== DELETE_PASSWORD) {
    return res.status(403).json({ error: 'パスワードが正しくありません。' });
  }

  try {
    await pool.query('DELETE FROM posts WHERE id = $1', [postId]);
    res.json({ success: true });
  } catch (err) {
    console.error('削除エラー:', err.message);
    res.status(500).json({ error: '削除に失敗しました。' });
  }
});

app.listen(port, () => {
  console.log(`サーバーが http://localhost:${port} で起動しました`);
  console.log('環境設定:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '設定されています' : '設定されていません');
}); 