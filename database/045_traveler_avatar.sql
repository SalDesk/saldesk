-- SalDesk Conect / conta de viajante -- foto de perfil
-- Upload real (nao base64) via backend/src/routes/upload.js, mesmo padrao
-- ja usado para operadores (logo_url) -- so o URL fica na BD.

alter table travelers add column if not exists avatar_url text;
