import { type NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requireSession } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { decrypt } from '@/lib/crypto';
import { fetchProjectRows } from '@/lib/projects';

// GET /api/export?q=  — download the current (optionally filtered) view as .xlsx.
//   Trainee: full table incl. decrypted credentials, for their assigned projects.
//   Trainer: oversight columns only (no credentials; link only when Deployed).
export async function GET(req: NextRequest) {
  try {
    const viewer = await requireSession();
    const q = req.nextUrl.searchParams.get('q') ?? undefined;
    const scope =
      req.nextUrl.searchParams.get('scope') === 'mine' ? 'mine' : undefined;
    const rows = await fetchProjectRows(viewer, q, scope);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Shared Dashboard';
    const sheet = workbook.addWorksheet('Projects');

    if (viewer.userType === 'trainer') {
      sheet.columns = [
        { header: 'Project', key: 'project', width: 28 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Deployment link', key: 'url', width: 40 },
        { header: 'Username', key: 'username', width: 24 },
        { header: 'Password', key: 'password', width: 24 },
        { header: 'Assigned trainees', key: 'assigned', width: 32 },
      ];
      sheet.getRow(1).font = { bold: true };
      for (const r of rows) {
        sheet.addRow({
          project: r.name,
          status: r.status,
          url: r.status === 'Deployed' ? r.url ?? '' : '',
          username: r.site_username_encrypted
            ? decrypt(r.site_username_encrypted)
            : '',
          password: r.site_password_encrypted
            ? decrypt(r.site_password_encrypted)
            : '',
          assigned: (r.assigned_users ?? []).map((u) => '@' + u.username).join(', '),
        });
      }
    } else {
      sheet.columns = [
        { header: 'Project', key: 'project', width: 28 },
        { header: 'URL', key: 'url', width: 40 },
        { header: 'Username', key: 'username', width: 24 },
        { header: 'Password', key: 'password', width: 24 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Team', key: 'team', width: 32 },
      ];
      sheet.getRow(1).font = { bold: true };
      for (const r of rows) {
        sheet.addRow({
          project: r.name,
          url: r.url ?? '',
          username: r.site_username_encrypted
            ? decrypt(r.site_username_encrypted)
            : '',
          password: r.site_password_encrypted
            ? decrypt(r.site_password_encrypted)
            : '',
          status: r.status,
          team: (r.assigned_users ?? []).map((u) => '@' + u.username).join(', '),
        });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="projects.xlsx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
