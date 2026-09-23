alter table public.affectations_horaires
  add column renfort_source_affectation_id uuid
  references public.affectations_horaires(id) on delete set null;

create index affectations_renfort_source_idx
  on public.affectations_horaires(renfort_source_affectation_id)
  where renfort_source_affectation_id is not null;

-- Link existing test reinforcements to the last available source at assignment time.
update public.affectations_horaires r
set renfort_source_affectation_id = (
  select h.affectation_id
  from public.presences_poste_historique h
  join public.affectations_horaires source on source.id = h.affectation_id
  where h.personne_id = r.personne_id
    and h.disponible = true
    and source.id <> r.id
    and source.debut <= r.debut
    and source.fin > r.debut
    and h.changed_at <= r.debut
  order by h.changed_at desc
  limit 1
)
where (r.note ilike 'Renfort%' or r.note ilike 'Affectation depuis la liste des bénévoles disponibles%')
  and r.renfort_source_affectation_id is null;

insert into public.affectation_lieux(affectation_id, lieu_id, ordre)
select r.id, r.lieu_id, 0
from public.affectations_horaires r
where r.renfort_source_affectation_id is not null and r.lieu_id is not null
and not exists (select 1 from public.affectation_lieux al where al.affectation_id=r.id and al.lieu_id=r.lieu_id);

create function public.gray_renforts_on_origin_return(p_source_id uuid, p_actor_id uuid)
returns void language sql security invoker set search_path to 'public'
as $function$
  with changed as (
    update public.presences_poste pp
    set statut='a_venir', disponible=false, retard_minutes=null,
        updated_by=p_actor_id, updated_at=now()
    from public.affectations_horaires r
    where r.id=pp.affectation_id
      and r.renfort_source_affectation_id=p_source_id
      and r.personne_id=p_actor_id
      and r.actif=true and r.fin>now()
      and (pp.statut is distinct from 'a_venir' or pp.disponible)
    returning pp.affectation_id, pp.personne_id
  )
  insert into public.presences_poste_historique
    (affectation_id,personne_id,statut,retard_minutes,disponible,changed_by)
  select affectation_id,personne_id,'a_venir',null,false,p_actor_id from changed;
$function$;

revoke all on function public.gray_renforts_on_origin_return(uuid,uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.assign_available_volunteer_to_active_post(p_personne_id uuid, p_poste_id bigint, p_lieu_id bigint DEFAULT NULL::bigint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid;
  v_actor_role public.portal_role;
  v_edition_id bigint;
  v_besoin_id uuid;
  v_fin timestamptz;
  v_affectation_id uuid;
  v_source_affectation_id uuid;
  v_latest_statut text;
  v_latest_disponible boolean;
begin
  perform public.reset_daily_presence_statuses();

  select b.id, pa.role, pa.edition_id
    into v_actor_id, v_actor_role, v_edition_id
  from public.benevoles b
  join public.participations pa on pa.benevole_id = b.id and pa.actif = true
  join public.editions e on e.id = pa.edition_id and e.active = true
  where b.user_id = auth.uid()
    and b.actif = true
  order by pa.created_at desc
  limit 1;

  if v_actor_role is null or v_actor_role not in ('responsable'::public.portal_role, 'admin'::public.portal_role) then
    raise exception 'Accès réservé aux responsables et admins';
  end if;

  if not exists (
    select 1
    from public.participations pa
    join public.benevoles b on b.id = pa.benevole_id and b.actif = true
    where pa.benevole_id = p_personne_id
      and pa.edition_id = v_edition_id
      and pa.actif = true
      and pa.role = 'benevole'::public.portal_role
  ) then
    raise exception 'Bénévole invalide pour cette édition';
  end if;

  select pp.affectation_id, pp.statut, pp.disponible
    into v_source_affectation_id, v_latest_statut, v_latest_disponible
  from public.presences_poste pp
  join public.affectations_horaires ah on ah.id = pp.affectation_id
  where pp.personne_id = p_personne_id
    and ah.edition_id = v_edition_id
  order by pp.updated_at desc, pp.id desc
  limit 1
  for update of pp;

  if v_latest_statut is distinct from 'present' or coalesce(v_latest_disponible, false) = false then
    raise exception 'Ce bénévole n''est plus disponible';
  end if;

  if not exists (
    select 1 from public.affectations_horaires ah
    where ah.id = v_source_affectation_id
      and ah.actif = true
      and ah.debut <= now()
      and ah.fin > now()
      and ah.renfort_source_affectation_id is null
  ) then
    raise exception 'La plage disponible n''est plus en cours';
  end if;

  if v_actor_role = 'responsable' and not exists (
    with recursive managed_posts as (
      select rp.poste_id
      from public.responsables_poste rp
      where rp.personne_id = v_actor_id
        and rp.edition_id = v_edition_id
        and rp.actif = true
      union
      select p.id
      from public.postes p
      join managed_posts mp on p.parent_poste_id = mp.poste_id
      where p.actif = true
    )
    select 1 from managed_posts where poste_id = p_poste_id
  ) then
    raise exception 'Ce poste ne fait pas partie de vos responsabilités';
  end if;

  select bh.id, max(bh.fin) over ()
    into v_besoin_id, v_fin
  from public.besoins_horaires bh
  where bh.edition_id = v_edition_id
    and bh.poste_id = p_poste_id
    and bh.lieu_id is not distinct from p_lieu_id
    and bh.actif = true
    and bh.debut <= now()
    and bh.fin > now()
  order by bh.fin desc, bh.debut asc, bh.id
  limit 1;

  if v_besoin_id is null then
    raise exception 'Ce poste n''est pas actuellement en cours';
  end if;

  insert into public.affectations_horaires (
    edition_id, personne_id, poste_id, lieu_id, besoin_id, debut, fin, note, actif, renfort_source_affectation_id
  ) values (
    v_edition_id, p_personne_id, p_poste_id, p_lieu_id, v_besoin_id, now(), v_fin,
    'Renfort affecté depuis la liste des bénévoles disponibles', true, v_source_affectation_id
  )
  returning id into v_affectation_id;

  if p_lieu_id is not null then
    insert into public.affectation_lieux(affectation_id, lieu_id, ordre)
    values (v_affectation_id, p_lieu_id, 0);
  end if;

  insert into public.presences_poste (
    affectation_id, personne_id, statut, retard_minutes, disponible, updated_by, updated_at, created_at
  ) values (
    v_affectation_id, p_personne_id, 'present', null, false, v_actor_id, now(), now()
  );

  insert into public.presences_poste_historique (
    affectation_id, personne_id, statut, retard_minutes, disponible, changed_by, changed_at
  ) values (
    v_affectation_id, p_personne_id, 'present', null, false, v_actor_id, now()
  );

  return v_affectation_id;
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
    and ah.personne_id = v_actor_id;

  if v_personne_id is null then
    raise exception 'Affectation non autorisée';
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

CREATE OR REPLACE FUNCTION public.get_my_next_shift()
 RETURNS TABLE(affectation_id uuid, debut timestamp with time zone, fin timestamp with time zone, poste_nom text, lieu_nom text, note text, responsable_prenom text, responsable_initiale text, responsable_telephone text, statut text, retard_minutes integer, disponible boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with recursive mine as (
    select ah.*
    from public.affectations_horaires ah
    join public.benevoles b on b.id = ah.personne_id
    join public.editions e on e.id = ah.edition_id
    where b.user_id = auth.uid()
      and ah.actif = true
      and e.active = true
      and ah.fin >= now()
    order by
      case when ah.debut <= now() and ah.fin > now() then 0 else 1 end,
      case when ah.renfort_source_affectation_id is null then 0 else 1 end,
      case when ah.debut <= now() and ah.fin > now() then ah.debut end desc,
      case when ah.debut > now() then ah.debut end asc
    limit 1
  ),
  chain as (
    select p.id, p.parent_poste_id, 0 as depth
    from public.postes p join mine m on m.poste_id = p.id
    union all
    select parent.id, parent.parent_poste_id, chain.depth + 1
    from chain
    join public.postes parent on parent.id = chain.parent_poste_id
  ),
  resp as (
    select b.prenom, left(b.nom,1) as initiale, b.telephone
    from chain c
    join mine m on true
    join public.responsables_poste rp on rp.poste_id = c.id and rp.edition_id = m.edition_id and rp.actif = true
    join public.benevoles b on b.id = rp.personne_id and b.actif = true
    order by c.depth asc, rp.ordre asc, b.prenom asc
    limit 1
  )
  select
    m.id,
    m.debut,
    m.fin,
    p.nom,
    l.nom,
    m.note,
    r.prenom,
    r.initiale,
    r.telephone,
    coalesce(pp.statut, 'a_venir'),
    pp.retard_minutes,
    coalesce(pp.disponible, false)
  from mine m
  join public.postes p on p.id = m.poste_id
  left join public.lieux l on l.id = m.lieu_id
  left join resp r on true
  left join public.presences_poste pp on pp.affectation_id = m.id;
$function$;

CREATE OR REPLACE FUNCTION public.get_planning_upcoming(p_day date, p_moment timestamp with time zone, p_poste_ids bigint[] DEFAULT NULL::bigint[], p_lieu_ids bigint[] DEFAULT NULL::bigint[])
 RETURNS TABLE(affectation_id uuid, personne_id uuid, prenom text, nom text, telephone text, poste_id bigint, poste_nom text, lieu_id bigint, lieu_nom text, debut timestamp with time zone, fin timestamp with time zone, statut text, retard_minutes integer, disponible boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with recursive actor as (
  select b.id personne_id, pa.role, pa.edition_id from benevoles b join participations pa on pa.benevole_id=b.id and pa.actif=true join editions e on e.id=pa.edition_id and e.active=true where b.user_id=auth.uid() and b.actif=true order by pa.created_at desc limit 1
), managed_roots as (
  select rp.poste_id from actor a join responsables_poste rp on rp.personne_id=a.personne_id and rp.edition_id=a.edition_id and rp.actif=true where a.role='responsable'
), ancestors as (
  select mr.poste_id from managed_roots mr
  union select p.parent_poste_id from postes p join ancestors a on p.id=a.poste_id where p.parent_poste_id is not null
), managed_posts as (
  select poste_id from ancestors
  union select p.id from postes p join managed_posts mp on p.parent_poste_id=mp.poste_id where p.actif=true
), loc as (
  select al.affectation_id, case when count(*)=1 then min(l.id) else null end as one_lieu_id,
         string_agg(l.nom, ' · ' order by al.ordre, l.nom) as lieu_nom
  from affectation_lieux al join lieux l on l.id=al.lieu_id group by al.affectation_id
)
select ah.id, ah.personne_id, b.prenom, b.nom, b.telephone, p.id, p.nom, loc.one_lieu_id, coalesce(loc.lieu_nom,'Lieu à confirmer'), ah.debut, ah.fin,
case when pp.statut is null then 'inconnu' when pp.statut='present' and pp.disponible then 'disponible' else pp.statut end,
pp.retard_minutes, coalesce(pp.disponible,false)
from affectations_horaires ah join actor a on a.edition_id=ah.edition_id join benevoles b on b.id=ah.personne_id and b.actif=true join postes p on p.id=ah.poste_id left join loc on loc.affectation_id=ah.id left join presences_poste pp on pp.affectation_id=ah.id
where ah.actif=true
and ah.renfort_source_affectation_id is null
and coalesce(ah.note,'') not ilike 'Renfort%'
and coalesce(ah.note,'') not ilike 'Affectation depuis la liste des bénévoles disponibles%'
and (ah.debut at time zone 'Europe/Brussels')::date=p_day and ah.fin>p_moment and (a.role='admin' or (a.role='responsable' and ah.poste_id in (select poste_id from managed_posts)))
and (p_poste_ids is null or ah.poste_id=any(p_poste_ids))
and (p_lieu_ids is null or exists(select 1 from affectation_lieux al2 where al2.affectation_id=ah.id and al2.lieu_id=any(p_lieu_ids)))
order by p.nom, coalesce(loc.lieu_nom,''), ah.debut, ah.fin, b.prenom, b.nom;
$function$;
