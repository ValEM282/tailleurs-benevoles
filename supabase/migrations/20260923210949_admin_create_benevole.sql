create or replace function public.admin_create_benevole(
  p_prenom text,
  p_nom text,
  p_telephone text,
  p_email text,
  p_tshirt text,
  p_tailloux integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_prenom text := btrim(coalesce(p_prenom, ''));
  v_nom text := upper(btrim(coalesce(p_nom, '')));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_telephone text := nullif(btrim(coalesce(p_telephone, '')), '');
  v_digits text;
  v_edition_id bigint;
  v_user_id uuid;
  v_benevole_id uuid;
begin
  if auth.uid() is null or not public.is_current_portal_admin() then
    raise exception 'Accès réservé aux administrateurs du portail.' using errcode = '42501';
  end if;

  if v_prenom = '' or v_nom = '' then
    raise exception 'Le prénom et le nom sont obligatoires.';
  end if;

  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Adresse e-mail invalide.';
  end if;

  if p_tshirt is null or p_tshirt not in ('0', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL') then
    raise exception 'Choix de T-shirt invalide.';
  end if;

  if p_tailloux is null or p_tailloux < 0 or p_tailloux > 25 then
    raise exception 'Le nombre de Tailloux doit être compris entre 0 et 25.';
  end if;

  if v_telephone is not null then
    if left(v_telephone, 1) = '+' or left(v_telephone, 2) = '00' then
      if left(v_telephone, 3) = '+32' or left(v_telephone, 4) = '0032' then
        raise exception 'Un numéro belge doit être au format 04XX XX XX XX.';
      end if;
    else
      v_digits := regexp_replace(v_telephone, '[^0-9]', '', 'g');
      if v_digits !~ '^04[0-9]{8}$' then
        raise exception 'Le numéro doit être au format 04XX XX XX XX, sauf numéro avec indicatif étranger.';
      end if;
      v_telephone := substr(v_digits, 1, 4) || ' ' || substr(v_digits, 5, 2) || ' ' ||
                     substr(v_digits, 7, 2) || ' ' || substr(v_digits, 9, 2);
    end if;
  end if;

  select e.id into v_edition_id
  from public.editions e
  where e.active = true
  order by e.annee desc
  limit 1;

  if v_edition_id is null then
    raise exception 'Aucune édition active ne permet de créer un bénévole.';
  end if;

  if exists (select 1 from public.benevoles b where lower(b.email) = v_email) then
    raise exception 'Cette adresse e-mail est déjà utilisée par un autre bénévole.' using errcode = '23505';
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = v_email
  limit 1;

  if v_user_id is not null and exists (
    select 1 from public.benevoles b where b.user_id = v_user_id
  ) then
    raise exception 'Ce compte du portail est déjà lié à un autre bénévole.';
  end if;

  begin
    insert into public.benevoles (prenom, nom, telephone, email, user_id)
    values (v_prenom, v_nom, v_telephone, v_email, v_user_id)
    returning id into v_benevole_id;
  exception when unique_violation then
    raise exception 'Cette adresse e-mail est déjà utilisée par un autre bénévole.' using errcode = '23505';
  end;

  insert into public.participations (benevole_id, edition_id, role, tshirt, tailloux)
  values (v_benevole_id, v_edition_id, 'benevole', p_tshirt, p_tailloux);

  return v_benevole_id;
end;
$function$;

revoke execute on function public.admin_create_benevole(text, text, text, text, text, integer) from public, anon;
grant execute on function public.admin_create_benevole(text, text, text, text, text, integer) to authenticated;
