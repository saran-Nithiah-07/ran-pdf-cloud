-- Track whether an uploaded file is a PDF or a Word document, so the
-- Dashboard can show the right icon and route "Open" to the right editor.
alter table public.files
  add column if not exists file_type text not null default 'pdf'
  check (file_type in ('pdf', 'docx'));
