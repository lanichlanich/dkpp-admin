import { BriefcaseBusiness, Building2, CakeSlice, CalendarClock, Gift, PartyPopper, Sparkles } from "lucide-react";
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/reui/timeline";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UpcomingBirthday, UpcomingRetirement } from "@/lib/employees";

const fullDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const weekdayFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function toUtcDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function formatDate(value: string) {
  return fullDateFormatter.format(toUtcDate(value));
}

function EmptyTimeline({ icon: Icon, title, description }: {
  icon: typeof CalendarClock;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
        <Icon className="size-5" />
      </div>
      <p className="font-medium text-zinc-700">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-zinc-500">{description}</p>
    </div>
  );
}

export function RetirementTimelinePanel({ employees }: { employees: UpcomingRetirement[] }) {
  const retirementGroups = Object.entries(
    Object.groupBy(employees, (employee) => employee.retirementTmt),
  ) as Array<[string, UpcomingRetirement[]]>;

  return (
    <Card className="min-w-0 gap-0 overflow-hidden py-0 shadow-sm ring-indigo-200/80">
      <CardHeader className="border-b border-indigo-100 bg-linear-to-br from-indigo-50 via-white to-sky-50 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 basis-52 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
              <CalendarClock aria-hidden="true" className="size-5 shrink-0" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Timeline Pensiun</p>
              <CardTitle className="mt-1 text-lg tracking-tight sm:text-xl"><h2>Pegawai Akan Pensiun</h2></CardTitle>
              <CardDescription className="mt-1 leading-5">Urutan TMT pensiun PNS, PPPK, dan PPPK PW aktif dalam lima tahun mendatang.</CardDescription>
            </div>
          </div>
          <div className="shrink-0 rounded-2xl border border-indigo-100 bg-white/90 px-3 py-2 text-center shadow-sm">
            <p className="text-xl font-semibold tabular-nums text-indigo-700">{employees.length}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Pegawai</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {employees.length === 0 ? (
          <EmptyTimeline
            icon={CalendarClock}
            title="Belum ada pegawai yang akan pensiun"
            description="Tidak ditemukan TMT pensiun dalam lima tahun mendatang."
          />
        ) : (
          <div role="region" aria-label="Daftar pegawai akan pensiun" tabIndex={0} className="max-h-[40rem] overflow-y-auto overscroll-y-contain bg-zinc-50/40 px-3 py-5 focus-visible:outline-2 focus-visible:outline-indigo-500 sm:px-5 sm:py-6">
            <Timeline
              defaultValue={retirementGroups.length}
              orientation="vertical"
              className="pr-1"
              style={{ flexDirection: "column" }}
            >
              {retirementGroups.map(([retirementTmt, dateEmployees], index) => (
                <TimelineItem
                  key={retirementTmt}
                  step={index + 1}
                  className="last:!pb-0"
                  style={{ flex: "none", marginInlineStart: "2rem", paddingBottom: "1.5rem" }}
                >
                  <TimelineIndicator
                    className="flex items-center justify-center border-4 border-indigo-100 bg-white shadow-sm"
                    style={{ left: "-1.5rem", top: 0, width: "1.5rem", height: "1.5rem", translate: "none", transform: "translateX(-50%)", zIndex: 1, borderColor: "var(--color-indigo-100)" }}
                  >
                    <span className="size-2 rounded-full bg-indigo-600" />
                  </TimelineIndicator>
                  <TimelineSeparator
                    className="bg-indigo-200"
                    style={{ left: "-1.5rem", top: "0.75rem", width: "0.125rem", height: "100%", translate: "none", transform: "translateX(-50%)", backgroundColor: "var(--color-indigo-200)" }}
                  />
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <TimelineDate dateTime={retirementTmt} className="mb-0 font-semibold text-indigo-700">
                      TMT {formatDate(retirementTmt)}
                    </TimelineDate>
                    {dateEmployees.length > 1 && (
                      <Badge className="bg-indigo-100 text-indigo-700">{dateEmployees.length} pegawai</Badge>
                    )}
                  </div>
                  <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm transition-all hover:border-indigo-200 hover:shadow-md">
                    {dateEmployees.map((employee, employeeIndex) => (
                      <div key={employee.nip} className={`p-4 ${employeeIndex > 0 ? "border-t border-zinc-100" : ""}`}>
                        <TimelineHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <TimelineTitle className="text-[15px] font-semibold leading-5 text-zinc-900">{employee.name}</TimelineTitle>
                            <p className="mt-1 font-mono text-[11px] tracking-wide text-zinc-500">NIP {employee.nip}</p>
                          </div>
                          <div className="flex flex-wrap gap-1.5 sm:shrink-0 sm:justify-end">
                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700">{employee.asnType}</Badge>
                            <Badge variant="outline" className="bg-zinc-50 text-zinc-600">BUP {employee.retirementAge} tahun</Badge>
                          </div>
                        </TimelineHeader>
                        <TimelineContent className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3">
                          <EmployeeDetails position={employee.position} unit={employee.unit} />
                        </TimelineContent>
                      </div>
                    ))}
                  </div>
                </TimelineItem>
              ))}
            </Timeline>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BirthdayTimelinePanel({ employees }: { employees: UpcomingBirthday[] }) {
  const birthdaysToday = employees.filter((employee) => employee.isToday);
  const upcomingBirthdays = employees.filter((employee) => !employee.isToday);
  const birthdayGroups = Object.entries(
    Object.groupBy(upcomingBirthdays, (employee) => employee.nextBirthday),
  ) as Array<[string, UpcomingBirthday[]]>;

  return (
    <Card className="min-w-0 gap-0 overflow-hidden py-0 shadow-sm ring-rose-200/80">
      <CardHeader className="border-b border-rose-100 bg-linear-to-br from-rose-50 via-white to-amber-50 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 basis-52 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-200">
              <CakeSlice aria-hidden="true" className="size-5 shrink-0" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-600">Timeline Ulang Tahun</p>
              <CardTitle className="mt-1 text-lg tracking-tight sm:text-xl"><h2>Ulang Tahun Mendatang</h2></CardTitle>
              <CardDescription className="mt-1 leading-5">Urutan ulang tahun pegawai aktif dalam enam bulan ke depan.</CardDescription>
            </div>
          </div>
          <div className="shrink-0 rounded-2xl border border-rose-100 bg-white/90 px-3 py-2 text-center shadow-sm">
            <p className="text-xl font-semibold tabular-nums text-rose-700">{employees.length}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Pegawai</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {birthdaysToday.length > 0 && <BirthdayCelebration employees={birthdaysToday} />}
        {upcomingBirthdays.length === 0 ? (
          <EmptyTimeline
            icon={CakeSlice}
            title={birthdaysToday.length > 0 ? "Tidak ada ulang tahun berikutnya" : "Belum ada ulang tahun mendatang"}
            description={birthdaysToday.length > 0
              ? "Selain perayaan hari ini, belum ada agenda ulang tahun lain dalam enam bulan ke depan."
              : "Tidak ditemukan ulang tahun pegawai dalam enam bulan ke depan."}
          />
        ) : (
          <div role="region" aria-label="Daftar ulang tahun mendatang" tabIndex={0} className="max-h-[40rem] overflow-y-auto overscroll-y-contain bg-zinc-50/40 px-3 py-5 focus-visible:outline-2 focus-visible:outline-rose-500 sm:px-5 sm:py-6">
            <Timeline
              defaultValue={birthdayGroups.length}
              orientation="vertical"
              className="pr-1"
              style={{ flexDirection: "column" }}
            >
              {birthdayGroups.map(([birthdayDate, dateEmployees], index) => (
                <TimelineItem
                  key={birthdayDate}
                  step={index + 1}
                  className="last:!pb-0"
                  style={{ flex: "none", marginInlineStart: "2rem", paddingBottom: "1.5rem" }}
                >
                  <TimelineIndicator
                    className="flex items-center justify-center border-4 border-rose-100 bg-white shadow-sm"
                    style={{ left: "-1.5rem", top: 0, width: "1.5rem", height: "1.5rem", translate: "none", transform: "translateX(-50%)", zIndex: 1, borderColor: "var(--color-rose-100)" }}
                  >
                    <span className="size-2 rounded-full bg-rose-600" />
                  </TimelineIndicator>
                  <TimelineSeparator
                    className="bg-rose-200"
                    style={{ left: "-1.5rem", top: "0.75rem", width: "0.125rem", height: "100%", translate: "none", transform: "translateX(-50%)", backgroundColor: "var(--color-rose-200)" }}
                  />
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <TimelineDate dateTime={birthdayDate} className="mb-0 font-semibold capitalize text-rose-700">
                      {weekdayFormatter.format(toUtcDate(birthdayDate))}
                    </TimelineDate>
                    {dateEmployees.length > 1 && (
                      <Badge className="bg-rose-100 text-rose-700">{dateEmployees.length} pegawai</Badge>
                    )}
                  </div>
                  <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm transition-all hover:border-rose-200 hover:shadow-md">
                    {dateEmployees.map((employee, employeeIndex) => (
                      <div key={employee.nip} className={`p-4 ${employeeIndex > 0 ? "border-t border-zinc-100" : ""}`}>
                        <TimelineHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <TimelineTitle className="text-[15px] font-semibold leading-5 text-zinc-900">{employee.name}</TimelineTitle>
                            <p className="mt-1 font-mono text-[11px] tracking-wide text-zinc-500">NIP {employee.nip}</p>
                          </div>
                          <div className="flex flex-wrap gap-1.5 sm:shrink-0 sm:justify-end">
                            <Badge variant="outline" className="bg-rose-50 text-rose-700">{employee.asnType}</Badge>
                            <Badge variant="outline" className="bg-zinc-50 text-zinc-600">Usia {employee.turningAge}</Badge>
                          </div>
                        </TimelineHeader>
                        <TimelineContent className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3">
                          <EmployeeDetails position={employee.position} unit={employee.unit} />
                        </TimelineContent>
                      </div>
                    ))}
                  </div>
                </TimelineItem>
              ))}
            </Timeline>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BirthdayCelebration({ employees }: { employees: UpcomingBirthday[] }) {
  return (
    <div className="border-b border-rose-100 bg-gradient-to-br from-rose-50 via-pink-50/70 to-amber-50 p-4">
      <div className="relative overflow-hidden rounded-2xl border border-rose-200 bg-white/90 p-4 shadow-sm">
        <Sparkles className="absolute right-4 top-3 size-5 text-amber-400" />
        <PartyPopper className="absolute -bottom-2 -right-1 size-16 rotate-[-12deg] text-rose-100" />
        <div className="relative flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-200">
            <PartyPopper className="size-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">Ulang Tahun Hari Ini</p>
              <Badge className="bg-rose-600 text-white">{employees.length} pegawai</Badge>
            </div>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">Selamat Ulang Tahun!</h3>
            <p className="mt-1 text-sm leading-6 text-zinc-600">Semoga selalu sehat, bahagia, dan sukses dalam menjalankan tugas.</p>
          </div>
        </div>

        <div className="relative mt-4 space-y-2">
          {employees.map((employee) => (
            <div key={employee.nip} className="flex items-center gap-3 rounded-xl border border-rose-100 bg-gradient-to-r from-white to-rose-50/70 p-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <Gift className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-5 text-zinc-900">{employee.name}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{employee.position || employee.unit || "Pegawai aktif"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-rose-700">{employee.turningAge} tahun</p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Hari ini</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmployeeDetails({ position, unit }: { position: string; unit: string }) {
  return (
    <>
      <div className="flex items-start gap-2 text-sm text-zinc-700">
        <BriefcaseBusiness className="mt-0.5 size-3.5 shrink-0 text-zinc-400" />
        <span className="leading-5">{position || "-"}</span>
      </div>
      <div className="flex items-start gap-2 text-xs text-zinc-500">
        <Building2 className="mt-0.5 size-3.5 shrink-0 text-zinc-400" />
        <span className="leading-5">{unit || "-"}</span>
      </div>
    </>
  );
}
