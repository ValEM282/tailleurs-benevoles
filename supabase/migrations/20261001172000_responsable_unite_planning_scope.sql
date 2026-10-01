-- Les responsables d'unité (Guides, Patro, Pionniers) doivent pouvoir
-- consulter les affectations de leurs animé·e·s à travers tous les postes.

create or replace function public.get_my_management_roles()
returns table(kind text, poste_id bigint, poste_nom text)
language sql
security definer
set search_path to 'public'
as $function$
with actor as (
  select b.id personne_id, pa.edition_id
  from benevoles b
  join participations pa on pa.benevole_id=b.id and pa.actif=true
  join editions e on e.id=pa.edition_id and e.active=true
  where b.user_id=auth.uid() and b.actif=true
  order by pa.created_at desc
  limit 1
)
select 'responsable'::text, p.id, p.nom
from actor a
join responsables_poste rp on rp.personne_id=a.personne_id and rp.edition_id=a.edition_id and rp.actif=true
join postes p on p.id=rp.poste_id and p.actif=true
union all
select 'co_responsable'::text, p.id, p.nom
from actor a
join coresponsables_poste cp on cp.personne_id=a.personne_id and cp.edition_id=a.edition_id and cp.actif=true
join postes p on p.id=cp.poste_id and p.actif=true
union all
select 'responsable_unite'::text, null::bigint, tb.nom
from actor a
join responsables_type_benevole rtb on rtb.personne_id=a.personne_id and rtb.edition_id=a.edition_id and rtb.actif=true
join types_benevoles tb on tb.id=rtb.type_benevole_id and tb.actif=true
order by 1,3
$function$;

create or replace function public.get_planning_filter_options()
returns table(jour date, poste_id bigint, poste_nom text, lieu_id bigint, lieu_nom text)
language sql
security definer
set search_path to 'public'
as $function$
with recursive actor as (
  select b.id personne_id, pa.role, pa.edition_id
  from benevoles b
  join participations pa on pa.benevole_id=b.id and pa.actif=true
  join editions e on e.id=pa.edition_id and e.active=true
  where b.user_id=auth.uid() and b.actif=true
  order by pa.created_at desc
  limit 1
),
managed_roots as (
  select mp.poste_id
  from actor a
  cross join lateral public.get_current_managed_post_ids() mp
  where a.role='responsable'
),
ancestors as (
  select mr.poste_id from managed_roots mr
  union
  select p.parent_poste_id
  from postes p
  join ancestors a on p.id=a.poste_id
  where p.parent_poste_id is not null
),
managed_posts as (
  select poste_id from ancestors
  union
  select p.id
  from postes p
  join managed_posts mp on p.parent_poste_id=mp.poste_id
  where p.actif=true
),
managed_types as (
  select rtb.type_benevole_id
  from actor a
  join responsables_type_benevole rtb
    on rtb.personne_id=a.personne_id
   and rtb.edition_id=a.edition_id
   and rtb.actif=true
  where a.role='responsable'
),
allowed as (
  select ah.*
  from affectations_horaires ah
  join actor a on a.edition_id=ah.edition_id
  where ah.actif=true
    and (
      a.role='admin'
      or (
        a.role='responsable'
        and (
          ah.poste_id in (select poste_id from managed_posts)
          or exists (
            select 1
            from participations target_pa
            where target_pa.benevole_id=ah.personne_id
              and target_pa.edition_id=a.edition_id
              and target_pa.actif=true
              and target_pa.type_benevole_id in (select type_benevole_id from managed_types)
          )
        )
      )
    )
),
assignment_locations as (
  select a.id as affectation_id, a.lieu_id
  from allowed a
  where a.lieu_id is not null
  union
  select al.affectation_id, al.lieu_id
  from affectation_lieux al
  join allowed a on a.id=al.affectation_id
)
select distinct
  public.portal_festival_day(a.debut) as jour,
  p.id as poste_id,
  p.nom as poste_nom,
  l.id as lieu_id,
  l.nom as lieu_nom
from allowed a
join postes p on p.id=a.poste_id and p.actif=true
left join assignment_locations al on al.affectation_id=a.id
left join lieux l on l.id=al.lieu_id
order by 1,3,5 nulls first
$function$;

create or replace function public.get_planning_complete_filter_options()
returns table(jour date, poste_id bigint, poste_nom text, parent_poste_id bigint, parent_poste_nom text, lieu_id bigint, lieu_nom text)
language sql
security definer
set search_path to 'public'
as $function$
with recursive actor as (
  select b.id personne_id, pa.role, pa.edition_id
  from benevoles b
  join participations pa on pa.benevole_id=b.id and pa.actif=true
  join editions e on e.id=pa.edition_id and e.active=true
  where b.user_id=auth.uid() and b.actif=true
  order by pa.created_at desc
  limit 1
),
managed_roots as (
  select mp.poste_id
  from actor a
  cross join lateral public.get_current_managed_post_ids() mp
  where a.role='responsable'
),
ancestors as (
  select mr.poste_id from managed_roots mr
  union
  select p.parent_poste_id
  from postes p
  join ancestors a on p.id=a.poste_id
  where p.parent_poste_id is not null
),
managed_posts as (
  select poste_id from ancestors
  union
  select p.id
  from postes p
  join managed_posts mp on p.parent_poste_id=mp.poste_id
  where p.actif=true
),
managed_types as (
  select rtb.type_benevole_id
  from actor a
  join responsables_type_benevole rtb
    on rtb.personne_id=a.personne_id
   and rtb.edition_id=a.edition_id
   and rtb.actif=true
  where a.role='responsable'
),
assignment_locations as (
  select ah.id as affectation_id, ah.lieu_id
  from affectations_horaires ah
  join actor a on a.edition_id=ah.edition_id
  where ah.actif=true and ah.lieu_id is not null
  union
  select al.affectation_id, al.lieu_id
  from affectation_lieux al
  join affectations_horaires ah on ah.id=al.affectation_id
  join actor a on a.edition_id=ah.edition_id
  where ah.actif=true
)
select distinct
  public.portal_festival_day(ah.debut) as jour,
  p.id as poste_id,
  p.nom as poste_nom,
  parent.id as parent_poste_id,
  parent.nom as parent_poste_nom,
  l.id as lieu_id,
  l.nom as lieu_nom
from affectations_horaires ah
join actor a on a.edition_id=ah.edition_id
join postes p on p.id=ah.poste_id and p.actif=true
left join postes parent on parent.id=p.parent_poste_id and parent.actif=true
left join assignment_locations al on al.affectation_id=ah.id
left join lieux l on l.id=al.lieu_id
where ah.actif=true
  and (
    a.role='admin'
    or (
      a.role='responsable'
      and (
        ah.poste_id in (select poste_id from managed_posts)
        or exists (
          select 1
          from participations target_pa
          where target_pa.benevole_id=ah.personne_id
            and target_pa.edition_id=a.edition_id
            and target_pa.actif=true
            and target_pa.type_benevole_id in (select type_benevole_id from managed_types)
        )
      )
    )
  )
order by 1,5 nulls first,3,7 nulls first
$function$;

create or replace function public.get_planning_now(
  p_moment timestamp with time zone,
  p_poste_ids bigint[] default null::bigint[],
  p_lieu_ids bigint[] default null::bigint[]
)
returns table(
  affectation_id uuid,
  personne_id uuid,
  prenom text,
  nom text,
  telephone text,
  poste_id bigint,
  poste_nom text,
  lieu_id bigint,
  lieu_nom text,
  debut timestamp with time zone,
  fin timestamp with time zone,
  statut text,
  retard_minutes integer,
  disponible boolean,
  renfort boolean
)
language sql
security definer
set search_path to 'public'
as $function$
with recursive actor as (
  select b.id personne_id, pa.role, pa.edition_id
  from benevoles b
  join participations pa on pa.benevole_id=b.id and pa.actif=true
  join editions e on e.id=pa.edition_id and e.active=true
  where b.user_id=auth.uid() and b.actif=true
  order by pa.created_at desc
  limit 1
),
managed_roots as (
  select mp.poste_id
  from actor a
  cross join lateral public.get_current_managed_post_ids() mp
  where a.role='responsable'
),
ancestors as (
  select mr.poste_id from managed_roots mr
  union
  select p.parent_poste_id
  from postes p
  join ancestors a on p.id=a.poste_id
  where p.parent_poste_id is not null
),
managed_posts as (
  select poste_id from ancestors
  union
  select p.id
  from postes p
  join managed_posts mp on p.parent_poste_id=mp.poste_id
  where p.actif=true
),
managed_types as (
  select rtb.type_benevole_id
  from actor a
  join responsables_type_benevole rtb
    on rtb.personne_id=a.personne_id
   and rtb.edition_id=a.edition_id
   and rtb.actif=true
  where a.role='responsable'
),
loc as (
  select al.affectation_id,
         case when count(*)=1 then min(l.id) else null end as one_lieu_id,
         string_agg(l.nom,' · ' order by al.ordre,l.nom) as lieu_nom
  from affectation_lieux al
  join lieux l on l.id=al.lieu_id
  group by al.affectation_id
)
select ah.id, ah.personne_id, b.prenom, b.nom, b.telephone, p.id, p.nom,
       loc.one_lieu_id, coalesce(loc.lieu_nom,'Lieu à confirmer'), ah.debut, ah.fin,
       case when pp.statut is null then 'inconnu'
            when pp.statut='present' and pp.disponible then 'disponible'
            else pp.statut end,
       pp.retard_minutes, coalesce(pp.disponible,false),
       (coalesce(ah.note,'') ilike 'Renfort%' or coalesce(ah.note,'') ilike 'Affectation depuis la liste des bénévoles disponibles%')
from affectations_horaires ah
join actor a on a.edition_id=ah.edition_id
join benevoles b on b.id=ah.personne_id and b.actif=true
join postes p on p.id=ah.poste_id
left join loc on loc.affectation_id=ah.id
left join presences_poste pp on pp.affectation_id=ah.id
where ah.actif=true
  and ah.debut<=p_moment
  and ah.fin>p_moment
  and (
    a.role='admin'
    or (
      a.role='responsable'
      and (
        ah.poste_id in (select poste_id from managed_posts)
        or exists (
          select 1
          from participations target_pa
          where target_pa.benevole_id=ah.personne_id
            and target_pa.edition_id=a.edition_id
            and target_pa.actif=true
            and target_pa.type_benevole_id in (select type_benevole_id from managed_types)
        )
      )
    )
  )
  and (p_poste_ids is null or ah.poste_id=any(p_poste_ids))
  and (p_lieu_ids is null or exists(
    select 1 from affectation_lieux al2
    where al2.affectation_id=ah.id and al2.lieu_id=any(p_lieu_ids)
  ))
order by p.nom, coalesce(loc.lieu_nom,''), ah.fin, b.prenom, b.nom
$function$;

create or replace function public.get_planning_upcoming(
  p_day date,
  p_moment timestamp with time zone,
  p_poste_ids bigint[] default null::bigint[],
  p_lieu_ids bigint[] default null::bigint[]
)
returns table(
  affectation_id uuid,
  personne_id uuid,
  prenom text,
  nom text,
  telephone text,
  poste_id bigint,
  poste_nom text,
  lieu_id bigint,
  lieu_nom text,
  debut timestamp with time zone,
  fin timestamp with time zone,
  statut text,
  retard_minutes integer,
  disponible boolean
)
language sql
security definer
set search_path to 'public'
as $function$
with recursive actor as (
  select b.id personne_id, pa.role, pa.edition_id
  from benevoles b
  join participations pa on pa.benevole_id=b.id and pa.actif=true
  join editions e on e.id=pa.edition_id and e.active=true
  where b.user_id=auth.uid() and b.actif=true
  order by pa.created_at desc
  limit 1
),
managed_roots as (
  select mp.poste_id
  from actor a
  cross join lateral public.get_current_managed_post_ids() mp
  where a.role='responsable'
),
ancestors as (
  select mr.poste_id from managed_roots mr
  union
  select p.parent_poste_id
  from postes p
  join ancestors a on p.id=a.poste_id
  where p.parent_poste_id is not null
),
managed_posts as (
  select poste_id from ancestors
  union
  select p.id
  from postes p
  join managed_posts mp on p.parent_poste_id=mp.poste_id
  where p.actif=true
),
managed_types as (
  select rtb.type_benevole_id
  from actor a
  join responsables_type_benevole rtb
    on rtb.personne_id=a.personne_id
   and rtb.edition_id=a.edition_id
   and rtb.actif=true
  where a.role='responsable'
),
loc_source_raw as (
  select ah.id affectation_id, ah.lieu_id, 0 ordre
  from affectations_horaires ah
  join actor a on a.edition_id=ah.edition_id
  where ah.actif=true and ah.lieu_id is not null
  union all
  select al.affectation_id, al.lieu_id, coalesce(al.ordre,1)
  from affectation_lieux al
  join affectations_horaires ah on ah.id=al.affectation_id
  join actor a on a.edition_id=ah.edition_id
  where ah.actif=true
),
loc_source as (
  select affectation_id, lieu_id, min(ordre) ordre
  from loc_source_raw
  group by affectation_id, lieu_id
),
loc as (
  select ls.affectation_id,
         case when count(*)=1 then min(l.id) else null end one_lieu_id,
         string_agg(l.nom,' · ' order by ls.ordre,l.nom) lieu_nom
  from loc_source ls
  join lieux l on l.id=ls.lieu_id
  group by ls.affectation_id
)
select ah.id, ah.personne_id, b.prenom, b.nom, b.telephone, p.id, p.nom,
       loc.one_lieu_id, coalesce(loc.lieu_nom,'Lieu à confirmer'), ah.debut, ah.fin,
       case when pp.statut is null then 'inconnu'
            when pp.statut='present' and pp.disponible then 'disponible'
            else pp.statut end,
       pp.retard_minutes, coalesce(pp.disponible,false)
from affectations_horaires ah
join actor a on a.edition_id=ah.edition_id
join benevoles b on b.id=ah.personne_id and b.actif=true
join postes p on p.id=ah.poste_id
left join loc on loc.affectation_id=ah.id
left join presences_poste pp on pp.affectation_id=ah.id
where ah.actif=true
  and ah.renfort_source_affectation_id is null
  and coalesce(ah.note,'') not ilike 'Renfort%'
  and coalesce(ah.note,'') not ilike 'Affectation depuis la liste des bénévoles disponibles%'
  and public.portal_festival_day(ah.debut)=p_day
  and ah.fin>p_moment
  and (
    a.role='admin'
    or (
      a.role='responsable'
      and (
        ah.poste_id in (select poste_id from managed_posts)
        or exists (
          select 1
          from participations target_pa
          where target_pa.benevole_id=ah.personne_id
            and target_pa.edition_id=a.edition_id
            and target_pa.actif=true
            and target_pa.type_benevole_id in (select type_benevole_id from managed_types)
        )
      )
    )
  )
  and (p_poste_ids is null or ah.poste_id=any(p_poste_ids))
  and (p_lieu_ids is null or exists(
    select 1 from loc_source ls2
    where ls2.affectation_id=ah.id and ls2.lieu_id=any(p_lieu_ids)
  ))
order by p.nom, coalesce(loc.lieu_nom,''), ah.debut, ah.fin, b.prenom, b.nom
$function$;

create or replace function public.set_managed_presence_status(p_affectation_id uuid, p_statut text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor_id uuid;
  v_role public.portal_role;
  v_edition_id bigint;
  v_target_personne uuid;
  v_target_poste bigint;
  v_target_lieu bigint;
  v_target_debut timestamptz;
  v_target_fin timestamptz;
  v_allowed boolean := false;
  v_store_statut text;
  v_disponible boolean := false;
  v_need_id uuid;
  v_need_start timestamptz;
begin
  if p_statut not in ('present','absent','disponible','en_pause','inconnu') then
    raise exception 'Statut invalide';
  end if;

  select b.id, pa.role, pa.edition_id
  into v_actor_id, v_role, v_edition_id
  from public.benevoles b
  join public.participations pa on pa.benevole_id=b.id and pa.actif=true
  join public.editions e on e.id=pa.edition_id and e.active=true
  where b.user_id=auth.uid() and b.actif=true
  order by pa.created_at desc
  limit 1;

  if v_actor_id is null or v_role not in ('responsable','admin') then
    raise exception 'Accès non autorisé';
  end if;

  select ah.personne_id, ah.poste_id, ah.lieu_id, ah.debut, ah.fin
  into v_target_personne, v_target_poste, v_target_lieu, v_target_debut, v_target_fin
  from public.affectations_horaires ah
  where ah.id=p_affectation_id
    and ah.edition_id=v_edition_id
    and ah.actif=true
    and ah.fin>clock_timestamp();

  if v_target_personne is null then
    raise exception 'Affectation introuvable ou terminée';
  end if;

  if v_role='admin' then
    v_allowed := true;
  else
    with recursive roots as (
      select rp.poste_id
      from public.responsables_poste rp
      where rp.personne_id=v_actor_id and rp.edition_id=v_edition_id and rp.actif=true
      union
      select cp.poste_id
      from public.coresponsables_poste cp
      where cp.personne_id=v_actor_id and cp.edition_id=v_edition_id and cp.actif=true
    ),
    tree as (
      select poste_id from roots
      union
      select p.id
      from public.postes p
      join tree t on p.parent_poste_id=t.poste_id
      where p.actif=true
    )
    select exists(select 1 from tree where poste_id=v_target_poste)
    into v_allowed;

    if not v_allowed then
      select exists (
        select 1
        from public.participations target_pa
        join public.responsables_type_benevole rtb
          on rtb.type_benevole_id=target_pa.type_benevole_id
         and rtb.edition_id=target_pa.edition_id
         and rtb.personne_id=v_actor_id
         and rtb.actif=true
        where target_pa.benevole_id=v_target_personne
          and target_pa.edition_id=v_edition_id
          and target_pa.actif=true
      ) into v_allowed;
    end if;
  end if;

  if not v_allowed then
    raise exception 'Affectation non autorisée';
  end if;

  if p_statut='disponible' then
    v_store_statut := 'present';
    v_disponible := true;
  elsif p_statut='inconnu' then
    v_store_statut := 'a_venir';
    v_disponible := false;
  else
    v_store_statut := p_statut;
    v_disponible := false;
  end if;

  insert into public.presences_poste(affectation_id, personne_id, statut, retard_minutes, disponible, updated_by, updated_at)
  values (p_affectation_id, v_target_personne, v_store_statut, null, v_disponible, v_actor_id, now())
  on conflict (affectation_id) do update
  set statut=excluded.statut,
      retard_minutes=null,
      disponible=excluded.disponible,
      updated_by=excluded.updated_by,
      updated_at=now();

  insert into public.presences_poste_historique(affectation_id, personne_id, statut, retard_minutes, disponible, changed_by)
  values (p_affectation_id, v_target_personne, v_store_statut, null, v_disponible, v_actor_id);

  if p_statut='absent' then
    if not exists (
      select 1
      from public.besoins_horaires bh
      where bh.source_affectation_id=p_affectation_id
        and bh.actif=true
        and bh.a_pourvoir=true
    ) then
      v_need_start := case
        when v_target_debut<=now() then date_trunc('minute',now())
        else v_target_debut
      end;

      if v_need_start<v_target_fin then
        insert into public.besoins_horaires(
          edition_id, poste_id, lieu_id, debut, fin, nombre_requis,
          source_jour, source_ligne, note, actif, a_pourvoir, source_affectation_id
        ) values (
          v_edition_id, v_target_poste, v_target_lieu, v_need_start, v_target_fin, 1,
          'ABSENCE', null, 'Créneau vacant automatiquement : bénévole absent', true, true, p_affectation_id
        ) returning id into v_need_id;

        insert into public.besoin_lieux(besoin_id, lieu_id, ordre)
        select v_need_id, al.lieu_id, al.ordre
        from public.affectation_lieux al
        where al.affectation_id=p_affectation_id;

        if not exists (select 1 from public.besoin_lieux bl where bl.besoin_id=v_need_id)
           and v_target_lieu is not null then
          insert into public.besoin_lieux(besoin_id, lieu_id, ordre)
          values (v_need_id, v_target_lieu, 0);
        end if;
      end if;
    end if;
  else
    update public.besoins_horaires
    set actif=false
    where source_affectation_id=p_affectation_id
      and actif=true
      and a_pourvoir=true;
  end if;
end;
$function$;
