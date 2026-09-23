CREATE OR REPLACE FUNCTION public.get_available_volunteers_all()
 RETURNS TABLE(personne_id uuid, prenom text, nom text, telephone text, disponible_depuis timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_role public.portal_role;
  v_edition_id bigint;
begin
  perform public.reset_daily_presence_statuses();

  select p.role, p.edition_id
    into v_actor_role, v_edition_id
  from public.benevoles b
  join public.participations p on p.benevole_id = b.id and p.actif = true
  join public.editions e on e.id = p.edition_id and e.active = true
  where b.user_id = auth.uid()
    and b.actif = true
  order by p.created_at desc
  limit 1;

  if v_actor_role is null or v_actor_role not in ('responsable'::public.portal_role, 'admin'::public.portal_role) then
    raise exception 'Accès réservé aux responsables et admins';
  end if;

  return query
  with volunteer_ids as (
    select part.benevole_id
    from public.participations part
    where part.edition_id = v_edition_id
      and part.actif = true
      and part.role = 'benevole'::public.portal_role
  ),
  latest_status as (
    select
      p.personne_id,
      p.affectation_id,
      p.statut,
      p.disponible,
      p.updated_at,
      row_number() over (
        partition by p.personne_id
        order by p.updated_at desc, p.id desc
      ) as rn
    from public.presences_poste p
    join public.affectations_horaires a on a.id = p.affectation_id
    join volunteer_ids v on v.benevole_id = p.personne_id
    where a.edition_id = v_edition_id
  )
  select
    b.id,
    b.prenom,
    b.nom,
    b.telephone,
    s.updated_at
  from latest_status s
  join public.benevoles b on b.id = s.personne_id
  where s.rn = 1
    and s.statut = 'present'
    and s.disponible = true
    and b.actif = true
    and exists (
      select 1 from public.affectations_horaires a
      where a.id = s.affectation_id
        and a.actif = true
        and a.debut <= now() and a.fin > now()
        and a.renfort_source_affectation_id is null
    )
  order by lower(b.nom), lower(b.prenom);
end;
$function$;
