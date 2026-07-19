"""
Temporary diagnostic: list recent push subscriptions + broadcast history, and optionally
send a real test push to a given subscription id. Delete this file once mobile push
delivery is confirmed working.
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from notifications.models import AdminBroadcastLog, PushSubscription
from notifications.push_backend import send_web_push, vapid_configured


class Command(BaseCommand):
    help = 'Diagnostic: recent push subscriptions + broadcast log.'

    def add_arguments(self, parser):
        parser.add_argument('--send-test', type=int, default=None, help='PushSubscription id to send a real test push to.')

    def handle(self, *args, **options):
        sub_id = options.get('send_test')
        if sub_id:
            self.stdout.write(f'vapid_configured={vapid_configured()}')
            try:
                sub = PushSubscription.objects.get(id=sub_id)
            except PushSubscription.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'No PushSubscription with id={sub_id}'))
                return
            self.stdout.write(f'Sending test push to sub id={sub.id} endpoint={sub.endpoint[:60]}...')
            ok, err = send_web_push(sub, {
                'title': 'Cridora test push',
                'body': 'If you see this in your tray, delivery works.',
                'url': '/marketplace',
                'category': 'admin_broadcast',
            })
            self.stdout.write(self.style.SUCCESS(f'ok={ok} err={err!r}') if ok else self.style.ERROR(f'ok={ok} err={err!r}'))
            return

        since = timezone.now() - timedelta(hours=12)
        subs = PushSubscription.objects.filter(created_at__gte=since).order_by('-created_at')
        self.stdout.write('--- subscriptions created in last 12h ---')
        for s in subs:
            self.stdout.write(
                f'id={s.id} user_id={s.user_id} active={s.is_active} '
                f'created={s.created_at} last_seen={s.last_seen_at} ua={(s.user_agent or "")[:90]}'
            )

        self.stdout.write('--- all active subscriptions (any age) ---')
        for s in PushSubscription.objects.filter(is_active=True).order_by('-created_at')[:30]:
            self.stdout.write(
                f'id={s.id} user_id={s.user_id} created={s.created_at} last_seen={s.last_seen_at} '
                f'ua={(s.user_agent or "")[:90]}'
            )

        self.stdout.write('--- recent admin broadcasts ---')
        for b in AdminBroadcastLog.objects.all()[:10]:
            self.stdout.write(
                f'id={b.id} kind={b.kind} audience={b.audience} recipients={b.recipients_count} '
                f'guests={b.guests_count} created={b.created_at} title={b.title!r}'
            )

        self.stdout.write(self.style.SUCCESS('done'))
