import { sqlClient } from "../db/index.js";

async function main() {
  console.log("=================================================");
  console.log("🔐 Menjalankan Seeding Akun Admin & Skema DB...");
  console.log("=================================================");

  try {
    // 1. Pastikan tabel users dan kolom margin ada
    await sqlClient`
      CREATE TABLE IF NOT EXISTS public.users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        role VARCHAR(50) NOT NULL DEFAULT 'customer',
        full_name VARCHAR(255),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    await sqlClient`
      ALTER TABLE public.products ADD COLUMN IF NOT EXISTS provider_price INTEGER;
    `;
    await sqlClient`
      ALTER TABLE public.products ADD COLUMN IF NOT EXISTS margin_value INTEGER NOT NULL DEFAULT 0;
    `;
    await sqlClient`
      UPDATE public.products 
      SET provider_price = price, margin_value = 0 
      WHERE provider_price IS NULL;
    `;

    // 2. Buat atau update admin user
    const adminEmail = 'admin@narapremium.com';
    const adminPass = 'AdminNara2026!';
    const adminId = 'a0000000-0000-0000-0000-000000000001';

    await sqlClient`
      DO $$
      DECLARE
        new_user_id UUID := ${adminId}::UUID;
        target_email TEXT := ${adminEmail};
        target_pass TEXT := ${adminPass};
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = target_email) THEN
          INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change,
            reauthentication_token,
            phone_change,
            phone_change_token,
            email_change_token_current,
            phone,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
          ) VALUES (
            '00000000-0000-0000-0000-000000000000'::UUID,
            new_user_id,
            'authenticated',
            'authenticated',
            target_email,
            crypt(target_pass, gen_salt('bf')),
            now(),
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
            '{"full_name":"Administrator Nara"}'::jsonb,
            now(),
            now()
          );

          INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
          ) VALUES (
            new_user_id,
            new_user_id,
            jsonb_build_object('sub', new_user_id::text, 'email', target_email),
            'email',
            target_email,
            now(),
            now(),
            now()
          );
        ELSE
          SELECT id INTO new_user_id FROM auth.users WHERE email = target_email;
        END IF;

        INSERT INTO public.users (
          id,
          email,
          role,
          full_name,
          is_active,
          created_at
        ) VALUES (
          new_user_id,
          target_email,
          'admin',
          'Administrator Nara',
          true,
          now()
        )
        ON CONFLICT (id) DO UPDATE 
        SET role = 'admin', full_name = 'Administrator Nara', is_active = true;

      END $$;
    `;

    console.log(`✅ Admin berhasil disiapkan: ${adminEmail} (password: ${adminPass})`);
  } catch (err: any) {
    console.error("❌ Gagal seeding admin:", err.message);
  } finally {
    await sqlClient.end();
    process.exit(0);
  }
}

main();
