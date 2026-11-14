# Encouragement messages (uppmuntran)

Short, warm notification texts for Aisha (story #119, task #120).

**This file is the source of truth.** Edit the messages here, then regenerate the app data:

```
node scripts/build-encouragement.mjs
```

That rewrites `src/data/reminders/encouragement.json`. Never edit the JSON by hand; `npm test` fails if the JSON and this file disagree.

**Status: draft. The author must review and edit every message before release.**

## Rules for editing

- Messages are in Swedish, like the app's other notifications. The indented `EN:` line under each message is only a translation to help review; it is ignored by the build.
- One message per line, in the form `- [id] text`. Ids must be unique; keep them when you edit a text, and pick a new id when you add one.
- `{name}` is replaced with her name. It is the only `{...}` placeholder allowed.
- Only personal encouragement: no Quran verses, no hadith, no religious quotations, no promises of reward or warnings of punishment. No Arabic script.
- Keep each message to one or two short sentences so it fits a phone notification.
- Groups (the `##` headings below) are used as follows:
  - `general`: any time of day, about the value of small effort, being appreciated, keeping going.
  - `goalDone`: she has done a goal today; celebrate it, small or big.
  - `goalPending`: a goal is not done yet; a gentle nudge with no guilt and no pressure.

## general

- [g01] {name}, även små steg räknas.
  - EN: {name}, even small steps count.
- [g02] Det du gör, hur lite det än känns, betyder något.
  - EN: What you do, however little it feels, matters.
- [g03] {name}, jag är stolt över dig. Varje dag.
  - EN: {name}, I'm proud of you. Every day.
- [g04] Lite i dag är mer än inget i dag.
  - EN: A little today is more than nothing today.
- [g05] Du behöver inte göra allt. Bara nästa lilla sak.
  - EN: You don't have to do everything. Just the next little thing.
- [g06] {name}, din ansträngning syns, även när du själv inte ser den.
  - EN: {name}, your effort is seen, even when you can't see it yourself.
- [g07] Ett steg i taget räcker gott.
  - EN: One step at a time is plenty.
- [g08] Det är okej att gå långsamt. Det viktiga är att du fortsätter.
  - EN: It's okay to go slowly. What matters is that you keep going.
- [g09] {name}, tänk på hur långt du redan har kommit.
  - EN: {name}, think of how far you've already come.
- [g10] Små stunder blir till stora saker när de får växa i lugn och ro.
  - EN: Small moments become big things when they're allowed to grow in peace.
- [g11] Du gör det bättre än du tror, {name}.
  - EN: You're doing better than you think, {name}.
- [g12] Varje minut du ger är värd något.
  - EN: Every minute you give is worth something.
- [g13] Ingen perfektion behövs. Bara du, precis som du är.
  - EN: No perfection needed. Just you, exactly as you are.
- [g14] {name}, det du bygger nu bygger du för dig själv. Det är fint.
  - EN: {name}, what you're building now, you're building for yourself. That's lovely.
- [g15] Glöm inte att vara snäll mot dig själv i dag.
  - EN: Don't forget to be kind to yourself today.
- [g16] Även en trött dag kan rymma en liten seger.
  - EN: Even a tired day can hold a small victory.
- [g17] {name}, du är uppskattad. Mer än du vet.
  - EN: {name}, you are appreciated. More than you know.
- [g18] Det som känns litet i dag kan bli grunden för något stort.
  - EN: What feels small today can become the foundation of something big.
- [g19] Du får börja om när som helst. Varje stund är en ny början.
  - EN: You can start again any time. Every moment is a new beginning.
- [g20] {name}, din vilja att försöka är redan något att vara stolt över.
  - EN: {name}, your will to try is already something to be proud of.
- [g21] Det är inte farten som räknas, utan att du är på väg.
  - EN: It's not the speed that counts, but that you're on your way.
- [g22] Ta ett andetag. Du klarar mer än du tror.
  - EN: Take a breath. You can handle more than you think.
- [g23] {name}, någon tänker på dig just nu och är glad att du finns.
  - EN: {name}, someone is thinking of you right now and is glad you exist.
- [g24] Lite varje dag blir mycket med tiden.
  - EN: A little every day becomes a lot over time.
- [g25] Du behöver inte känna dig redo. Det räcker att börja smått.
  - EN: You don't need to feel ready. Starting small is enough.
- [g26] {name}, varje gång du väljer att försöka väljer du något fint.
  - EN: {name}, every time you choose to try, you choose something good.
- [g27] Ditt tålamod med dig själv är också en styrka.
  - EN: Your patience with yourself is a strength too.
- [g28] Små vanor bär långt. Du är på rätt väg.
  - EN: Small habits carry far. You're on the right path.
- [g29] Kom ihåg: den enda du behöver jämföra dig med är den du var i går.
  - EN: Remember: the only one you need to compare yourself with is who you were yesterday.
- [g30] {name}, du har kommit hit. Det är inte lite.
  - EN: {name}, you've made it this far. That's not nothing.
- [g31] Det du gör i det tysta räknas lika mycket.
  - EN: What you do quietly counts just as much.
- [g32] En liten insats med hela hjärtat är värd mycket.
  - EN: A small effort made with your whole heart is worth a lot.
- [g33] {name}, du får vara stolt över dig själv i dag.
  - EN: {name}, you're allowed to be proud of yourself today.
- [g34] Det finns ingen början som är för liten.
  - EN: There is no beginning that is too small.
- [g35] Fortsätt i din egen takt. Den är precis rätt.
  - EN: Keep going at your own pace. It's exactly right.

## goalDone

- [d01] {name}, du gjorde det! Dagens mål är klart.
  - EN: {name}, you did it! Today's goal is done.
- [d02] Klart för i dag. Var stolt, du förtjänar det.
  - EN: Done for today. Be proud, you deserve it.
- [d03] Vad fint, {name}. Ännu ett mål i hamn.
  - EN: How lovely, {name}. Another goal safely home.
- [d04] Litet eller stort, du fullföljde det. Det är det som räknas.
  - EN: Small or big, you saw it through. That's what counts.
- [d05] {name}, jag är så glad för din skull i dag.
  - EN: {name}, I'm so happy for you today.
- [d06] Där satt den. Bra jobbat!
  - EN: Nailed it. Well done!
- [d07] Du höll ditt löfte till dig själv i dag. Det är stort.
  - EN: You kept your promise to yourself today. That's big.
- [d08] {name}, se vad du klarade! Ta en stund och känn efter.
  - EN: {name}, look what you managed! Take a moment to feel it.
- [d09] Ännu en dag där du valde att göra det. Snyggt.
  - EN: Another day where you chose to do it. Nice.
- [d10] Mål uppnått. Nu kan du andas ut.
  - EN: Goal reached. Now you can breathe out.
- [d11] {name}, det här är precis så framsteg ser ut.
  - EN: {name}, this is exactly what progress looks like.
- [d12] Varje klart mål är en liten byggsten. I dag lade du en till.
  - EN: Every finished goal is a small building block. Today you laid another one.
- [d13] Du gjorde det, och du gjorde det i din egen takt. Perfekt.
  - EN: You did it, and you did it at your own pace. Perfect.
- [d14] {name}, du är fantastisk. Dagens mål är avklarat.
  - EN: {name}, you're amazing. Today's goal is complete.
- [d15] Ett litet mål som är klart är fortfarande ett mål som är klart. Bra gjort!
  - EN: A small goal that's done is still a goal that's done. Well done!
- [d16] Tack för att du gav dig själv den här stunden i dag.
  - EN: Thank you for giving yourself this moment today.
- [d17] {name}, din insats i dag gör skillnad.
  - EN: {name}, your effort today makes a difference.
- [d18] Klart! Resten av dagen får vara lätt.
  - EN: Done! The rest of the day can be easy.
- [d19] Du dök upp för dig själv i dag. Det är värt att fira.
  - EN: You showed up for yourself today. That's worth celebrating.
- [d20] {name}, en dag i taget, och i dag blev det en bra en.
  - EN: {name}, one day at a time, and today was a good one.
- [d21] Så stolt över dig. Verkligen.
  - EN: So proud of you. Truly.
- [d22] Ännu ett mål bakom dig. Du växer, steg för steg.
  - EN: Another goal behind you. You're growing, step by step.
- [d23] {name}, det spelar ingen roll hur stort det var. Du gjorde det.
  - EN: {name}, it doesn't matter how big it was. You did it.
- [d24] Fint jobbat i dag. Ge dig själv en klapp på axeln.
  - EN: Nice work today. Give yourself a pat on the back.
- [d25] Du hittade tiden, även en dag som denna. Imponerande.
  - EN: You found the time, even on a day like this. Impressive.
- [d26] {name}, dagens mål: klart. Dagens känsla: välförtjänt stolthet.
  - EN: {name}, today's goal: done. Today's feeling: well-earned pride.
- [d27] Det du gjorde i dag kommer du att vara glad för i morgon.
  - EN: What you did today, you'll be glad of tomorrow.
- [d28] Bra, {name}. Lugnt och fint, precis som det ska vara.
  - EN: Good, {name}. Calm and steady, just as it should be.
- [d29] Varje gång du gör klart ett mål blir nästa lite lättare.
  - EN: Every time you finish a goal, the next one gets a little easier.
- [d30] {name}, du gjorde din del i dag. Nu får du vila.
  - EN: {name}, you did your part today. Now you can rest.
- [d31] Klart och fint. Den här dagen räknas.
  - EN: Done and lovely. This day counts.
- [d32] Du är på väg, och det märks. Bra jobbat!
  - EN: You're on your way, and it shows. Well done!
- [d33] {name}, ditt tålamod lönar sig. Dagens mål är nått.
  - EN: {name}, your patience is paying off. Today's goal is reached.

## goalPending

- [p01] {name}, även två minuter räknas. Vill du ta en liten stund nu?
  - EN: {name}, even two minutes count. Want to take a little moment now?
- [p02] En sida är fortfarande en sida.
  - EN: One page is still a page.
- [p03] Ingen stress. Dagens mål väntar på dig när du är redo.
  - EN: No stress. Today's goal is waiting for you whenever you're ready.
- [p04] {name}, lite är bättre än inget. Och lite räcker gott i dag.
  - EN: {name}, a little is better than nothing. And a little is plenty today.
- [p05] Har du en minut över? Det kan vara precis vad som behövs.
  - EN: Have a spare minute? It might be just what's needed.
- [p06] Du behöver inte göra allt. Börja bara med en liten bit.
  - EN: You don't have to do it all. Just start with a small piece.
- [p07] {name}, dagen är inte slut än. Det finns tid för ett litet steg.
  - EN: {name}, the day isn't over yet. There's time for a small step.
- [p08] Det är okej om det blir mindre i dag. Mindre är också bra.
  - EN: It's okay if it's less today. Less is good too.
- [p09] Ett litet steg nu kan kännas skönt i kväll.
  - EN: A small step now can feel good tonight.
- [p10] {name}, hur kort stunden än blir så räknas den.
  - EN: {name}, however short the moment is, it counts.
- [p11] Inget krav, bara en vänlig påminnelse: ditt mål finns kvar här.
  - EN: No demand, just a friendly reminder: your goal is still here.
- [p12] Fem minuter i soffan med en kopp te? Det räcker.
  - EN: Five minutes on the sofa with a cup of tea? That's enough.
- [p13] {name}, du behöver inte känna för det. Börja smått och se vad som händer.
  - EN: {name}, you don't have to feel like it. Start small and see what happens.
- [p14] Det är aldrig för sent för en liten stund.
  - EN: It's never too late for a little moment.
- [p15] Om dagen har varit tung, gör bara lite. Det är mer än nog.
  - EN: If the day has been heavy, just do a little. That's more than enough.
- [p16] {name}, en enda rad är också en början.
  - EN: {name}, a single line is a beginning too.
- [p17] Ditt mål är ingen plikt. Det är en present till dig själv.
  - EN: Your goal isn't a duty. It's a gift to yourself.
- [p18] Kanske en liten stund innan nästa sak? Bara om det passar.
  - EN: Maybe a little moment before the next thing? Only if it suits you.
- [p19] {name}, du har gjort det förut och du kan göra det i dag, i liten skala.
  - EN: {name}, you've done it before and you can do it today, on a small scale.
- [p20] Ingen skuld här. Bara en mjuk knuff: två minuter?
  - EN: No guilt here. Just a soft nudge: two minutes?
- [p21] Ibland är det svåraste att bara öppna appen. Resten blir lättare.
  - EN: Sometimes the hardest part is just opening the app. The rest gets easier.
- [p22] {name}, ett halvt steg är också ett steg.
  - EN: {name}, half a step is still a step.
- [p23] Du bestämmer takten. Även lite i dag gör skillnad.
  - EN: You set the pace. Even a little today makes a difference.
- [p24] Om du bara orkar en minut, så är en minut perfekt.
  - EN: If you only have the energy for one minute, one minute is perfect.
- [p25] {name}, ditt mål väntar tålmodigt. Ingen brådska.
  - EN: {name}, your goal is waiting patiently. No rush.
- [p26] Små stunder bär långt. Har du en sådan nu?
  - EN: Small moments carry far. Do you have one now?
- [p27] Det gör inget att det inte blivit av än. Det finns fortfarande tid.
  - EN: It doesn't matter that it hasn't happened yet. There's still time.
- [p28] {name}, prova bara att börja. Du får sluta när du vill.
  - EN: {name}, just try starting. You can stop whenever you like.
- [p29] Hellre lite och lugnt än inget alls. Du klarar det.
  - EN: Better a little and calm than nothing at all. You can do it.
- [p30] En liten bit i dag håller tråden vid liv.
  - EN: A little piece today keeps the thread alive.
- [p31] {name}, du ligger inte efter. Du är precis där du är, och det är okej.
  - EN: {name}, you're not behind. You're right where you are, and that's okay.
- [p32] Om inte nu, kanske senare? Ditt mål finns kvar när du är redo.
  - EN: If not now, maybe later? Your goal will be here when you're ready.
