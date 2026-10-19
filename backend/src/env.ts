// Muat .env (jika ada) sebelum modul lain dibaca. Variabel yang sudah diset di environment tidak ditimpa.
try {
  process.loadEnvFile();
} catch {
  /* tidak ada .env — pakai environment bawaan (mis. Docker) */
}
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET wajib diisi di production');
}
