CREATE OR REPLACE FUNCTION public.admin_update_affectation_horaire(p_affectation_id uuid, p_poste_id bigint, p_lieu_id bigint, p_debut timestamp with time zone, p_fin timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_current_portal_admin() then
    raise exception 'Accès réservé aux administrateurs du portail.' using errcode = '42501';
  end if;

  if p_fin <= clock_timestamp() then
    raise exception 'Une plage terminée ne peut pas être enregistrée.' using errcode = '22023';
  end if;

  if p_fin <= p_debut then
    raise exception 'La fin doit être postérieure au début.' using errcode = '22007';
  end if;

  if not exists (select 1 from public.postes where id = p_poste_id and actif = true) then
    raise exception 'Poste invalide.' using errcode = '22023';
  end if;

  if p_lieu_id is not null and not exists (select 1 from public.lieux where id = p_lieu_id and actif = true) then
    raise exception 'Lieu invalide.' using errcode = '22023';
  end if;

  update public.affectations_horaires ah
  set poste_id = p_poste_id,
      lieu_id = p_lieu_id,
      debut = p_debut,
      fin = p_fin
  from public.editions e
  where ah.id = p_affectation_id
    and ah.edition_id = e.id
    and e.active = true
    and ah.actif = true
    and ah.fin > clock_timestamp();

  if not found then
    raise exception 'Affectation introuvable, inactive ou terminée.' using errcode = 'P0002';
  end if;

  delete from public.affectation_lieux where affectation_id = p_affectation_id;

  if p_lieu_id is not null then
    insert into public.affectation_lieux (affectation_id, lieu_id, ordre)
    values (p_affectation_id, p_lieu_id, 0);
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_affectation_horaire(p_affectation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_current_portal_admin() then
    raise exception 'Accès réservé aux administrateurs du portail.' using errcode = '42501';
  end if;

  update public.affectations_horaires ah
  set actif = false
  from public.editions e
  where ah.id = p_affectation_id
    and ah.edition_id = e.id
    and e.active = true
    and ah.actif = true
    and ah.fin > clock_timestamp();

  if not found then
    raise exception 'Affectation introuvable, inactive ou terminée.' using errcode = 'P0002';
  end if;

  delete from public.affectation_lieux
  where affectation_id = p_affectation_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_add_affectation_horaire(p_source_affectation_id uuid, p_poste_id bigint, p_lieu_id bigint, p_debut timestamp with time zone, p_fin timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  src public.affectations_horaires%rowtype;
  new_id uuid;
begin
  if not public.is_current_portal_admin() then
    raise exception 'Accès réservé aux administrateurs du portail.' using errcode = '42501';
  end if;

  if p_fin <= clock_timestamp() then
    raise exception 'Une plage terminée ne peut pas être ajoutée.' using errcode = '22023';
  end if;

  if p_fin <= p_debut then
    raise exception 'La fin doit être postérieure au début.' using errcode = '22007';
  end if;

  select ah.* into src
  from public.affectations_horaires ah
  join public.editions e on e.id = ah.edition_id
  where ah.id = p_source_affectation_id
    and ah.actif = true
    and ah.fin > clock_timestamp()
    and e.active = true;

  if not found then
    raise exception 'Affectation source introuvable, inactive ou terminée.' using errcode = 'P0002';
  end if;

  insert into public.affectations_horaires(
    edition_id, personne_id, poste_id, lieu_id, besoin_id, debut, fin, note, actif
  ) values (
    src.edition_id, src.personne_id, p_poste_id, p_lieu_id, null, p_debut, p_fin, src.note, true
  ) returning id into new_id;

  if p_lieu_id is not null then
    insert into public.affectation_lieux (affectation_id, lieu_id, ordre)
    values (new_id, p_lieu_id, 0);
  end if;

  return new_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_managed_presence_status(p_affectation_id uuid, p_statut text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid;
  v_role public.portal_role;
  v_edition_id bigint;
  v_target_personne uuid;
  v_target_poste bigint;
  v_allowed boolean := false;
  v_store_statut text;
  v_disponible boolean := false;
begin
  if p_statut not in ('present','absent','disponible','en_pause','inconnu') then
    raise exception 'Statut invalide';
  end if;

  select b.id, pa.role, pa.edition_id
  into v_actor_id, v_role, v_edition_id
  from public.benevoles b
  join public.participations pa on pa.benevole_id = b.id and pa.actif = true
  join public.editions e on e.id = pa.edition_id and e.active = true
  where b.user_id = auth.uid() and b.actif = true
  order by pa.created_at desc
  limit 1;

  if v_actor_id is null or v_role not in ('responsable','admin') then
    raise exception 'Accès non autorisé';
  end if;

  select ah.personne_id, ah.poste_id
  into v_target_personne, v_target_poste
  from public.affectations_horaires ah
  where ah.id = p_affectation_id and ah.edition_id = v_edition_id
    and ah.actif = true and ah.fin > clock_timestamp();

  if v_target_personne is null then
    raise exception 'Affectation introuvable ou terminée';
  end if;

  if v_role = 'admin' then
    v_allowed := true;
  else
    with recursive roots as (
      select rp.poste_id
      from public.responsables_poste rp
      where rp.personne_id = v_actor_id and rp.edition_id = v_edition_id and rp.actif = true
    ), tree as (
      select poste_id from roots
      union
      select p.id from public.postes p join tree t on p.parent_poste_id = t.poste_id where p.actif = true
    )
    select exists(select 1 from tree where poste_id = v_target_poste) into v_allowed;
  end if;

  if not v_allowed then
    raise exception 'Affectation non autorisée';
  end if;

  if p_statut = 'disponible' then
    v_store_statut := 'present';
    v_disponible := true;
  elsif p_statut = 'inconnu' then
    v_store_statut := 'a_venir';
    v_disponible := false;
  else
    v_store_statut := p_statut;
    v_disponible := false;
  end if;

  insert into public.presences_poste(affectation_id, personne_id, statut, retard_minutes, disponible, updated_by, updated_at)
  values (p_affectation_id, v_target_personne, v_store_statut, null, v_disponible, v_actor_id, now())
  on conflict (affectation_id) do update
    set statut = excluded.statut,
        retard_minutes = null,
        disponible = excluded.disponible,
        updated_by = excluded.updated_by,
        updated_at = now();

  insert into public.presences_poste_historique(affectation_id, personne_id, statut, retard_minutes, disponible, changed_by)
  values (p_affectation_id, v_target_personne, v_store_statut, null, v_disponible, v_actor_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_my_presence_status(p_affectation_id uuid, p_statut text, p_retard_minutes integer DEFAULT NULL::integer, p_disponible boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_personne_id uuid;
  v_actor_id uuid;
  v_store_statut text;
  v_store_disponible boolean;
begin
  if p_statut not in ('a_venir','present','retard','absent','hors_poste','termine','en_pause','inconnu','disponible') then
    raise exception 'Statut invalide';
  end if;

  if p_statut = 'retard' and (p_retard_minutes is null or p_retard_minutes not in (5,10,15,20,30,45,60)) then
    raise exception 'Minutes de retard invalides';
  end if;

  select b.id into v_actor_id
  from public.benevoles b
  where b.user_id = auth.uid() and b.actif = true;

  select ah.personne_id into v_personne_id
  from public.affectations_horaires ah
  where ah.id = p_affectation_id
    and ah.actif = true
    and ah.personne_id = v_actor_id
    and ah.fin > clock_timestamp();

  if v_personne_id is null then
    raise exception 'Affectation non autorisée ou terminée';
  end if;

  if p_statut = 'inconnu' then
    delete from public.presences_poste
    where affectation_id = p_affectation_id
      and personne_id = v_personne_id;

    insert into public.presences_poste_historique(
      affectation_id, personne_id, statut, retard_minutes, disponible, changed_by
    ) values (
      p_affectation_id, v_personne_id, 'inconnu', null, false, v_actor_id
    );
    perform public.gray_renforts_on_origin_return(p_affectation_id, v_actor_id);
    return;
  end if;

  v_store_statut := case when p_statut = 'disponible' then 'present' else p_statut end;
  v_store_disponible := case
    when p_statut = 'disponible' then true
    when v_store_statut = 'present' then coalesce(p_disponible, false)
    else false
  end;

  insert into public.presences_poste(
    affectation_id, personne_id, statut, retard_minutes, disponible, updated_by, updated_at
  ) values (
    p_affectation_id,
    v_personne_id,
    v_store_statut,
    case when v_store_statut = 'retard' then p_retard_minutes else null end,
    v_store_disponible,
    v_actor_id,
    now()
  )
  on conflict (affectation_id) do update
    set statut = excluded.statut,
        retard_minutes = excluded.retard_minutes,
        disponible = excluded.disponible,
        updated_by = excluded.updated_by,
        updated_at = now();

  insert into public.presences_poste_historique(
    affectation_id, personne_id, statut, retard_minutes, disponible, changed_by
  ) values (
    p_affectation_id,
    v_personne_id,
    v_store_statut,
    case when v_store_statut = 'retard' then p_retard_minutes else null end,
    v_store_disponible,
    v_actor_id
  );

  if p_statut <> 'disponible' then
    perform public.gray_renforts_on_origin_return(p_affectation_id, v_actor_id);
  end if;
end;
$function$;
