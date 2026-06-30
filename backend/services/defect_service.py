from sqlmodel import Session, select
from models import DefectRecord, POD
from services.audit_service import AuditService

# Severity weights used to derive a single "weighted defect score" so releases
# with a few critical defects rank worse than many low-severity ones.
WEIGHTS = {'critical': 10, 'high': 5, 'medium': 2, 'low': 1}


def _total(critical, high, medium, low):
    return int(critical) + int(high) + int(medium) + int(low)


def _weighted(critical, high, medium, low):
    return (critical * WEIGHTS['critical'] + high * WEIGHTS['high']
            + medium * WEIGHTS['medium'] + low * WEIGHTS['low'])


def _to_dict(d: DefectRecord):
    return {
        'id': d.id,
        'release': d.release,
        'sprint': d.sprint,
        'pod': d.pod,
        'critical': d.critical,
        'high': d.high,
        'medium': d.medium,
        'low': d.low,
        'total': _total(d.critical, d.high, d.medium, d.low),
        'weighted': _weighted(d.critical, d.high, d.medium, d.low),
        'status': d.status,
        'rca_category': d.rca_category,
        'rca_status': d.rca_status,
        'rca': d.rca,
        'comments': d.comments,
    }


def _ints(critical, high, medium, low):
    """Coerce severity counts to non-negative ints (treat blanks/None as 0)."""
    def n(v):
        try:
            return max(0, int(v or 0))
        except (TypeError, ValueError):
            return 0
    return n(critical), n(high), n(medium), n(low)


class DefectService:
    @staticmethod
    def list(session: Session):
        rows = session.exec(select(DefectRecord)).all()
        return [_to_dict(d) for d in rows]

    @staticmethod
    def create(session: Session, release, sprint, pod, critical, high, medium, low,
               comments, status=None, rca_category=None, rca=None, rca_status=None):
        release = (release or '').strip()
        sprint = (sprint or '').strip()
        pod = (pod or '').strip()
        if not release or not sprint:
            raise ValueError('Release and sprint are required')
        if pod and not session.get(POD, pod):
            raise ValueError(f'Unknown POD code "{pod}"')
        c, h, m, lo = _ints(critical, high, medium, low)
        existing = session.exec(
            select(DefectRecord).where(
                DefectRecord.release == release,
                DefectRecord.sprint == sprint,
                DefectRecord.pod == pod,
            )
        ).first()
        if existing:
            raise ValueError(f'A record for {release} / {sprint} / {pod or "(no POD)"} already exists')
        row = DefectRecord(release=release, sprint=sprint, pod=pod,
                           critical=c, high=h, medium=m, low=lo,
                           status=(status or 'Open'), rca_category=(rca_category or ''),
                           rca_status=(rca_status or 'Not Started'),
                           rca=(rca or ''), comments=comments or '')
        session.add(row)
        session.commit()
        session.refresh(row)
        AuditService.log(session, 'CREATE', 'Defect', f'{release}|{sprint}|{pod}')
        return _to_dict(row)

    @staticmethod
    def update(session: Session, defect_id, release=None, sprint=None, pod=None,
               critical=None, high=None, medium=None, low=None, comments=None,
               status=None, rca_category=None, rca=None, rca_status=None):
        row = session.get(DefectRecord, defect_id)
        if not row:
            return None
        if release is not None:
            row.release = release.strip()
        if sprint is not None:
            row.sprint = sprint.strip()
        if pod is not None:
            pod = pod.strip()
            if pod and not session.get(POD, pod):
                raise ValueError(f'Unknown POD code "{pod}"')
            row.pod = pod
        if critical is not None:
            row.critical = max(0, int(critical))
        if high is not None:
            row.high = max(0, int(high))
        if medium is not None:
            row.medium = max(0, int(medium))
        if low is not None:
            row.low = max(0, int(low))
        if status is not None:
            row.status = status
        if rca_category is not None:
            row.rca_category = rca_category
        if rca_status is not None:
            row.rca_status = rca_status
        if rca is not None:
            row.rca = rca
        if comments is not None:
            row.comments = comments
        session.add(row)
        session.commit()
        session.refresh(row)
        AuditService.log(session, 'UPDATE', 'Defect', str(defect_id))
        return _to_dict(row)

    @staticmethod
    def delete(session: Session, defect_id):
        row = session.get(DefectRecord, defect_id)
        if not row:
            return None
        session.delete(row)
        session.commit()
        AuditService.log(session, 'DELETE', 'Defect', str(defect_id))
        return {'ok': True}

    @staticmethod
    def bulk_upsert(session: Session, rows):
        """Create or update many defect records from an uploaded sheet.

        The natural key is (release, sprint, pod): matching rows are updated,
        new combinations created. Row numbers start at 2 to match the sheet
        (row 1 = header). Bad rows are skipped, not fatal.
        """
        pod_codes = {p.code for p in session.exec(select(POD)).all()}
        created = updated = 0
        errors = []
        for idx, r in enumerate(rows, start=2):
            release = (r.release or '').strip()
            sprint = (r.sprint or '').strip()
            pod = (r.pod or '').strip()
            if not release or not sprint:
                errors.append({'row': idx, 'error': 'Release and Sprint are required'})
                continue
            if pod and pod not in pod_codes:
                errors.append({'row': idx, 'error': f'Unknown POD "{pod}"'})
                continue
            c, h, m, lo = _ints(r.critical, r.high, r.medium, r.low)
            existing = session.exec(
                select(DefectRecord).where(
                    DefectRecord.release == release,
                    DefectRecord.sprint == sprint,
                    DefectRecord.pod == pod,
                )
            ).first()
            if existing:
                existing.critical, existing.high, existing.medium, existing.low = c, h, m, lo
                if r.status is not None:
                    existing.status = r.status or 'Open'
                if r.rca_category is not None:
                    existing.rca_category = r.rca_category
                if r.rca_status is not None:
                    existing.rca_status = r.rca_status or 'Not Started'
                if r.rca is not None:
                    existing.rca = r.rca
                if r.comments is not None:
                    existing.comments = r.comments
                session.add(existing)
                updated += 1
            else:
                session.add(DefectRecord(release=release, sprint=sprint, pod=pod,
                                         critical=c, high=h, medium=m, low=lo,
                                         status=(r.status or 'Open'), rca_category=(r.rca_category or ''),
                                         rca_status=(r.rca_status or 'Not Started'),
                                         rca=(r.rca or ''), comments=r.comments or ''))
                created += 1
        session.commit()
        AuditService.log(session, 'UPSERT', 'Defect', f'bulk +{created} / ~{updated}')
        return {'created': created, 'updated': updated, 'errors': errors, 'total': len(rows)}

    @staticmethod
    def report(session: Session):
        """Aggregate post-production defects by release, by sprint and by POD,
        plus an overall total. Mirrors what the report UI renders."""
        rows = session.exec(select(DefectRecord)).all()

        def blank():
            return {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'total': 0, 'weighted': 0, 'records': 0}

        def add(bucket, d):
            bucket['critical'] += d.critical
            bucket['high'] += d.high
            bucket['medium'] += d.medium
            bucket['low'] += d.low
            bucket['total'] += _total(d.critical, d.high, d.medium, d.low)
            bucket['weighted'] += _weighted(d.critical, d.high, d.medium, d.low)
            bucket['records'] += 1

        by_release, by_sprint, by_pod, by_status, by_category, by_rca_status = {}, {}, {}, {}, {}, {}
        totals = blank()
        for d in rows:
            add(by_release.setdefault(d.release or '(unspecified)', blank()), d)
            add(by_sprint.setdefault(d.sprint or '(unspecified)', blank()), d)
            add(by_pod.setdefault(d.pod or '(no POD)', blank()), d)
            add(by_status.setdefault(d.status or '(unspecified)', blank()), d)
            add(by_category.setdefault(d.rca_category or '(uncategorised)', blank()), d)
            add(by_rca_status.setdefault(d.rca_status or '(unspecified)', blank()), d)
            add(totals, d)

        def listify(group):
            return [{'key': k, **v} for k, v in sorted(group.items())]

        return {
            'totals': totals,
            'weights': WEIGHTS,
            'by_release': listify(by_release),
            'by_sprint': listify(by_sprint),
            'by_pod': listify(by_pod),
            'by_status': listify(by_status),
            'by_category': listify(by_category),
            'by_rca_status': listify(by_rca_status),
        }
