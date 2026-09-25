create or replace function public.owner_update_admin(
  p_user_id uuid,
  p_display_name text,
  p_payment_email text,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if not public.is_trackit_owner() then
    raise exception 'Owner access required';
  end if;

  select role into v_role
  from public.admins
  where user_id = p_user_id;

  if v_role is null then
    raise exception 'Admin not found';
  end if;

  if v_role = 'owner' and coalesce(p_active, true) = false then
    raise exception 'The owner account cannot be disabled';
  end if;

  update public.admins
  set
    display_name = nullif(trim(p_display_name), ''),
    payment_email = lower(trim(p_payment_email)),
    active = case when v_role = 'owner' then true else coalesce(p_active, true) end
  where user_id = p_user_id;
end;
$$;
