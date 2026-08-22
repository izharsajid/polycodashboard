# Open questions

Blocking Phase B. Nothing here blocks Tabs 1 to 3.

## Access and disclosure

- [x] Resolved 22 August 2026, by Izhar. `AUTH-SPEC.md` stands. One site, one build, one
      set of figures, every signed-in user seeing all of them, with individual pay the
      only exclusion and it applies to everyone. `src/redaction`, the `VITE_MODE` split
      and the partner build are retired. See `BUILD-SPEC.md` section 3.
- [ ] Display names for the three Polyco addresses and for Hamza. The user record carries
      a name and it is shown in the header and the admin list. Needed at gate 4, not
      before.
- [ ] How does an invitation or a reset link actually reach somebody? `AUTH-SPEC.md`
      section 3 lists the stack and there is no mail provider in it, so nothing can be
      sent today. The flows are built and tested against a delivery seam in
      `netlify/lib/delivery.ts` whose default sends nothing, which is what section 1 asks
      for right now. A provider has to be chosen before gate 4 can be tested end to end
      against a scratch address, and certainly before anyone is invited. Netlify has no
      mail service of its own, so this means a third party and a key to go with it.

## Machines and capacity
- [ ] How many machines exist on site, how many running, how many installed but idle?
- [ ] Practical output per machine in units and kg per hour; cycle time; cavities; uptime %
- [ ] Operators required per machine per shift, and the shift pattern at each configuration
- [ ] Which moulds are available, and which products can be run today?
- [ ] Cases per container and units per case, by SKU

## Cost by configuration
- [ ] Direct headcount at 1–2, 3–4, 5–6 and 7–8 machines
- [ ] Which costs continue during a temporary shutdown, and which stop
- [ ] One-off cost to stop, one-off cost to restart, restart lead time in weeks

## Roadmap
- [ ] Sequence from today's machine count to eight: what is added at each step
- [ ] Investment and lead time per step
- [ ] Sustained monthly order volume that triggers each step
- [ ] Physical ceiling of the Hidd site

## Polyco
- [ ] Read-only Supabase key for the efdashboard PO tracker
- [ ] Which open POs are paid as new cash and which draw down the existing advance
- [ ] Finished goods on the floor: quantity, value, PO allocation
- [ ] Pipeline to 31 December from Polyco

## Parked exceptions
See BUILD-SPEC.md section 8a. None block the build; all must be resolved before anything
is issued to Polyco.
