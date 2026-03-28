-- Update notification trigger to use Doum/Domi terminology.

create or replace function public.notify_on_task_change()
returns trigger language plpgsql security definer as $$
declare
  tname text := public.short_title(new.title);
begin
  -- open → accepted (domi clicked Accept, no approval required)
  if old.status = 'open' and new.status = 'accepted' and new.runner_id is not null then
    insert into public.notifications(user_id, task_id, type, title, body)
      values (new.poster_id, new.id, 'task_accepted',
              'Doum accepted',
              'A domi accepted your doum "' || tname || '"');

  -- open → pending_runner_approval (domi applied, poster must approve)
  elsif old.status = 'open' and new.status = 'pending_runner_approval' and new.runner_id is not null then
    insert into public.notifications(user_id, task_id, type, title, body)
      values (new.poster_id, new.id, 'runner_joined',
              'Domi wants your doum',
              'A domi applied for "' || tname || '" — approve or reject them.');

  -- pending_runner_approval → accepted (poster approved domi)
  elsif old.status = 'pending_runner_approval' and new.status = 'accepted' then
    insert into public.notifications(user_id, task_id, type, title, body)
      values (new.runner_id, new.id, 'task_accepted',
              'You''ve been approved',
              'The poster approved you as domi for "' || tname || '"');

  -- pending_runner_approval → open (poster rejected domi)
  elsif old.status = 'pending_runner_approval' and new.status = 'open' then
    if old.runner_id is not null then
      insert into public.notifications(user_id, task_id, type, title, body)
        values (old.runner_id, new.id, 'runner_joined',
                'Application not approved',
                'The poster didn''t approve you for "' || tname || '"');
    end if;

  -- accepted → open (domi backed out)
  elsif old.status = 'accepted' and new.status = 'open' and new.runner_id is null then
    insert into public.notifications(user_id, task_id, type, title, body)
      values (new.poster_id, new.id, 'runner_joined',
              'Domi backed out',
              'Your domi dropped "' || tname || '" — it''s open again.');

  -- accepted → pending_confirmation (domi marked done)
  elsif old.status = 'accepted' and new.status = 'pending_confirmation' then
    insert into public.notifications(user_id, task_id, type, title, body)
      values (new.poster_id, new.id, 'task_pending',
              'Doum marked done',
              'Your domi says "' || tname || '" is complete. Confirm or dispute.');

  -- pending_confirmation → completed (poster confirmed)
  elsif old.status = 'pending_confirmation' and new.status = 'completed' then
    insert into public.notifications(user_id, task_id, type, title, body)
      values (new.runner_id, new.id, 'task_completed',
              'Payment received',
              'Poster confirmed "' || tname || '" — tokens sent!');

  -- pending_confirmation → disputed
  elsif old.status = 'pending_confirmation' and new.status = 'disputed' then
    insert into public.notifications(user_id, task_id, type, title, body)
      values (new.runner_id, new.id, 'task_pending',
              'Doum disputed',
              'The poster opened a dispute on "' || tname || '"');
    insert into public.notifications(user_id, task_id, type, title, body)
      values (new.poster_id, new.id, 'task_pending',
              'Dispute submitted',
              'Your dispute on "' || tname || '" is under admin review.');

  end if;

  return new;
end;
$$;
