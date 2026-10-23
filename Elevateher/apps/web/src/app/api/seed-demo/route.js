import sql from "@/app/api/utils/sql";

// Demo data seeder — GET /api/seed-demo to populate demo data
// DELETE THIS ROUTE AFTER SEEDING IN PRODUCTION
export async function GET() {
  try {
    // Seed institutions
    await sql`
      INSERT INTO institutions (name, country, type, contact_email, subscription_plan, max_mentees, max_mentors, pilot_start, pilot_end)
      VALUES
        ('INTI International University', 'MY', 'university', 'elevateher@inti.edu.my', 'pilot', 200, 50, '2026-01-01', '2026-12-31'),
        ('Nanyang Polytechnic', 'SG', 'polytechnic', 'elevateher@nyp.edu.sg', 'pilot', 150, 40, '2026-01-01', '2026-12-31'),
        ('BINUS University', 'ID', 'university', 'elevateher@binus.ac.id', 'pilot', 180, 45, '2026-01-01', '2026-12-31'),
        ('Prince of Songkla University', 'TH', 'university', 'elevateher@psu.ac.th', 'pilot', 120, 30, '2026-01-01', '2026-12-31'),
        ('Kansai University', 'JP', 'university', 'elevateher@kansai-u.ac.jp', 'pilot', 100, 25, '2026-01-01', '2026-12-31'),
        ('Teesside University', 'GB', 'university', 'elevateher@tees.ac.uk', 'pilot', 80, 20, '2026-01-01', '2026-12-31')
      ON CONFLICT DO NOTHING
    `;

    const insts = await sql`SELECT id, name, country FROM institutions WHERE contact_email LIKE 'elevateher@%'`;

    // Admin user
    await sql`
      INSERT INTO users (email, role, country, language, is_verified, institution_id)
      VALUES ('demo.admin.inti@elevateher.demo', 'institution_admin', 'MY', 'en', true, (SELECT id FROM institutions WHERE name = 'INTI International University' LIMIT 1))
      ON CONFLICT (email) DO NOTHING
    `;

    const mentorData = [
      {
        email: "demo.mentor.priya@elevateher.demo",
        full_name: "Priya Krishnamurthy",
        job_title: "Senior Data Scientist",
        employer: "Grab",
        industry: "Technology",
        years_exp: 9,
        skills: ["Python", "Machine Learning", "Data Analysis"],
        country: "SG",
        bio: "I am a senior data scientist at Grab with 9 years of experience. I mentor girls interested in Python, data analysis, and ethical AI careers through structured weekly sessions on ElevateHer.",
        languages: ["en", "ms"],
        is_approved: true,
        is_suspended: false,
        bio_safety_score: 0.95,
        bio_flags: [],
        current_mentees: 1
      },
      {
        email: "demo.mentor.unsafe@elevateher.demo",
        full_name: "Demo Unsafe Mentor",
        job_title: "Software Engineer",
        employer: "TechCorp",
        industry: "Technology",
        years_exp: 5,
        skills: ["JavaScript", "React"],
        country: "MY",
        bio: "I can help you privately. Add me on WhatsApp and do not tell anyone, this will be only between us.",
        languages: ["en", "ms"],
        is_approved: false,
        is_suspended: false,
        bio_safety_score: 0.3,
        bio_flags: ["off_platform_solicitation", "intimacy_escalation"],
        current_mentees: 0
      },
      {
        email: "demo.mentor.suspended@elevateher.demo",
        full_name: "Demo Suspended Mentor",
        job_title: "Data Analyst",
        employer: "DataCo",
        industry: "Technology",
        years_exp: 4,
        skills: ["SQL", "Tableau"],
        country: "MY",
        bio: "I am a data analyst.",
        languages: ["en", "ms"],
        is_approved: true,
        is_suspended: true,
        bio_safety_score: 0.8,
        bio_flags: [],
        current_mentees: 0
      },
      {
        email: "demo.mentor.full@elevateher.demo",
        full_name: "Demo Full Capacity Mentor",
        job_title: "Product Manager",
        employer: "Axiata",
        industry: "Technology",
        years_exp: 8,
        skills: ["Product Strategy"],
        country: "MY",
        bio: "I love mentoring and have a full roster.",
        languages: ["en", "ms"],
        is_approved: true,
        is_suspended: false,
        bio_safety_score: 0.9,
        bio_flags: [],
        current_mentees: 3
      },
    ];

    for (const m of mentorData) {
      await sql`
        INSERT INTO users (email, role, country, language, age, is_verified, is_suspended)
        VALUES (${m.email}, 'mentor', ${m.country}, 'en', ${35 + Math.floor(Math.random() * 15)}, true, ${m.is_suspended})
        ON CONFLICT (email) DO UPDATE SET is_suspended = ${m.is_suspended}
      `;
      const uRows = await sql`SELECT id FROM users WHERE email = ${m.email}`;
      if (!uRows[0]) continue;
      await sql`
        INSERT INTO mentor_profiles (user_id, full_name, display_name, job_title, employer, industry, years_exp, skills, languages, bio, verification_status, is_approved, is_active, can_mentor_minors, code_of_conduct_signed, bio_safety_score, bio_flags, max_mentees)
        VALUES (${uRows[0].id}, ${m.full_name}, ${m.full_name}, ${m.job_title}, ${m.employer}, ${m.industry}, ${m.years_exp}, ${m.skills}, ${m.languages}, ${m.bio}, ${m.is_approved ? 'approved' : 'pending_admin_review'}, ${m.is_approved}, true, true, true, ${m.bio_safety_score}, ${m.bio_flags}, 3)
        ON CONFLICT (user_id) DO UPDATE SET is_approved = ${m.is_approved}, bio_safety_score = ${m.bio_safety_score}
      `;
    }

    const menteeData = [
      {
        email: "demo.mentee.aisha@elevateher.demo",
        full_name: "Aisha Binti Ahmad",
        sdg_track: "STEM",
        country: "MY",
        age: 20,
        goals: ["software_engineer", "data_scientist"],
        langs: ["en", "ms"],
      }
    ];

    const instMap = {};
    insts.forEach((i) => {
      instMap[i.country?.trim()] = i.id;
    });

    for (const me of menteeData) {
      const instId = instMap[me.country] || insts[0]?.id;
      await sql`
        INSERT INTO users (email, role, country, language, age, institution_id, is_verified)
        VALUES (${me.email}, 'mentee', ${me.country}, ${me.langs[0]}, ${me.age}, ${instId || null}, true)
        ON CONFLICT (email) DO NOTHING
      `;
      const uRows = await sql`SELECT id FROM users WHERE email = ${me.email}`;
      if (!uRows[0]) continue;
      await sql`
        INSERT INTO mentee_profiles (user_id, full_name, display_name, career_goals, sdg_track, preferred_languages, onboarding_complete)
        VALUES (${uRows[0].id}, ${me.full_name}, ${me.full_name}, ${me.goals}, ${me.sdg_track}, ${me.langs}, true)
        ON CONFLICT (user_id) DO NOTHING
      `;
    }

    // Matches
    const menteeAisha = (await sql`SELECT id FROM users WHERE email = 'demo.mentee.aisha@elevateher.demo'`)[0];
    const mentorPriya = (await sql`SELECT id FROM users WHERE email = 'demo.mentor.priya@elevateher.demo'`)[0];
    const mentorFull = (await sql`SELECT id FROM users WHERE email = 'demo.mentor.full@elevateher.demo'`)[0];
    
    if (menteeAisha && mentorPriya) {
      // 1. Active match
      await sql`
        INSERT INTO matches (mentee_id, mentor_id, institution_id, match_score, match_reason, status, started_at)
        VALUES (${menteeAisha.id}, ${mentorPriya.id}, (SELECT institution_id FROM users WHERE id = ${menteeAisha.id}), 0.95, 'Matched by AI: shared language + career track alignment', 'active', now() - INTERVAL '1 weeks')
        ON CONFLICT DO NOTHING
      `;
      
      const activeMatchRows = await sql`SELECT id FROM matches WHERE mentee_id = ${menteeAisha.id} AND mentor_id = ${mentorPriya.id} AND status = 'active'`;
      const activeMatchId = activeMatchRows[0]?.id;
      
      if (activeMatchId) {
        // Active session with safe messages
        await sql`
          INSERT INTO sessions (match_id, session_num)
          VALUES (${activeMatchId}, 1)
          ON CONFLICT DO NOTHING
        `;
        
        const activeSessionRows = await sql`SELECT id FROM sessions WHERE match_id = ${activeMatchId}`;
        const activeSessionId = activeSessionRows[0]?.id;
        
        if (activeSessionId) {
          await sql`
            INSERT INTO session_messages (session_id, sender_id, sender_role, content, safety_score, is_flagged)
            VALUES 
              (${activeSessionId}, ${menteeAisha.id}, 'mentee', 'Hi Priya, thanks for matching with me! I really want to learn Python.', 0.99, false),
              (${activeSessionId}, ${mentorPriya.id}, 'mentor', 'Hi Aisha! I am looking forward to our mentorship.', 0.99, false),
              (${activeSessionId}, ${menteeAisha.id}, 'mentee', 'Which data science concepts should I start with?', 0.99, false),
              (${activeSessionId}, ${mentorPriya.id}, 'mentor', 'We can start with pandas and data manipulation.', 0.99, false),
              (${activeSessionId}, ${menteeAisha.id}, 'mentee', 'Sounds perfect. See you at our scheduled time.', 0.99, false)
          `;
        }
      }

      // 2. Pending match
      const mentorSuspended = (await sql`SELECT id FROM users WHERE email = 'demo.mentor.suspended@elevateher.demo'`)[0];
      if (mentorSuspended) {
        await sql`
          INSERT INTO matches (mentee_id, mentor_id, institution_id, match_score, match_reason, status, started_at)
          VALUES (${menteeAisha.id}, ${mentorSuspended.id}, (SELECT institution_id FROM users WHERE id = ${menteeAisha.id}), 0.88, 'Strong career overlap', 'pending', now() - INTERVAL '2 days')
          ON CONFLICT DO NOTHING
        `;
      }

      // 3. Completed match
      const mentorFull = (await sql`SELECT id FROM users WHERE email = 'demo.mentor.full@elevateher.demo'`)[0];
      if (mentorFull) {
        await sql`
          INSERT INTO matches (mentee_id, mentor_id, institution_id, match_score, match_reason, status, started_at, completed_at)
          VALUES (${menteeAisha.id}, ${mentorFull.id}, (SELECT institution_id FROM users WHERE id = ${menteeAisha.id}), 0.92, 'Excellent track record', 'completed', now() - INTERVAL '3 months', now() - INTERVAL '1 days')
          ON CONFLICT DO NOTHING
        `;
        const compMatchRows = await sql`SELECT id FROM matches WHERE mentee_id = ${menteeAisha.id} AND mentor_id = ${mentorFull.id} AND status = 'completed'`;
        const compMatchId = compMatchRows[0]?.id;
        if (compMatchId) {
          // Completed session with AI summary
          await sql`
            INSERT INTO sessions (match_id, session_num)
            VALUES (${compMatchId}, 1)
            ON CONFLICT DO NOTHING
          `;
        }
      }

      // 4. Grooming match
      const mentorUnsafe = (await sql`SELECT id FROM users WHERE email = 'demo.mentor.unsafe@elevateher.demo'`)[0];
      if (mentorUnsafe) {
        await sql`
          INSERT INTO matches (mentee_id, mentor_id, institution_id, match_score, match_reason, status, started_at)
          VALUES (${menteeAisha.id}, ${mentorUnsafe.id}, (SELECT institution_id FROM users WHERE id = ${menteeAisha.id}), 0.80, 'Potential overlap', 'active', now() - INTERVAL '1 weeks')
          ON CONFLICT DO NOTHING
        `;
        const groomingMatchRows = await sql`SELECT id FROM matches WHERE mentee_id = ${menteeAisha.id} AND mentor_id = ${mentorUnsafe.id} AND status = 'active'`;
        const groomingMatchId = groomingMatchRows[0]?.id;
        
        if (groomingMatchId) {
          await sql`
            INSERT INTO sessions (match_id, session_num)
            VALUES (${groomingMatchId}, 1)
            ON CONFLICT DO NOTHING
          `;
          
          const groomingSessionRows = await sql`SELECT id FROM sessions WHERE match_id = ${groomingMatchId}`;
          const groomingSessionId = groomingSessionRows[0]?.id;
          
          if (groomingSessionId) {
            await sql`
              INSERT INTO session_messages (session_id, sender_id, sender_role, content, safety_score, is_flagged)
              VALUES 
                (${groomingSessionId}, ${menteeAisha.id}, 'mentee', 'Hi! Thanks for accepting my match request.', 0.99, false),
                (${groomingSessionId}, ${mentorUnsafe.id}, 'mentor', 'Hey there. Add me on WhatsApp so we can talk privately without the app.', 0.30, true)
            `;
          }
        }
      }
    }
    
    // Fill capacity for full mentor
    if (mentorFull) {
      for(let i = 0; i < 3; i++) {
        const dummyMenteeEmail = `dummy.mentee.${i}@elevateher.demo`;
        await sql`
          INSERT INTO users (email, role, country, language, is_verified) VALUES (${dummyMenteeEmail}, 'mentee', 'MY', 'en', true) ON CONFLICT DO NOTHING
        `;
        const dummyId = (await sql`SELECT id FROM users WHERE email = ${dummyMenteeEmail}`)[0]?.id;
        if (dummyId) {
          await sql`
            INSERT INTO matches (mentee_id, mentor_id, match_score, match_reason, status)
            VALUES (${dummyId}, ${mentorFull.id}, 0.8, 'Dummy match', 'active') ON CONFLICT DO NOTHING
          `;
        }
      }
    }

    // Safety Reports
    const unsafeMentor = (await sql`SELECT id FROM users WHERE email = 'demo.mentor.unsafe@elevateher.demo'`)[0];
    if (unsafeMentor && menteeAisha) {
      const groomingSessionRow = await sql`SELECT s.id, m.id as match_id FROM sessions s JOIN matches m ON s.match_id = m.id WHERE m.mentor_id = ${unsafeMentor.id} AND m.mentee_id = ${menteeAisha.id}`;
      const groomingSessionId = groomingSessionRow[0]?.id || null;
      const groomingMatchId = groomingSessionRow[0]?.match_id || null;

      await sql`
        INSERT INTO safety_reports (reporter_id, reported_user_id, session_id, match_id, reason, description, severity, status, created_at)
        VALUES 
          (${menteeAisha.id}, ${unsafeMentor.id}, ${groomingSessionId}, ${groomingMatchId}, 'off_platform_solicitation', 'Asked to move to WhatsApp and keep it secret.', 'critical', 'open', now() - INTERVAL '1 hours')
      `;
    }

    // Impact Events
    // Skipping impact events for demo to avoid enum constraints

    return Response.json({
      success: true,
      message: "Demo data seeded successfully!",
    });
  } catch (err) {
    console.error("Seed demo error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
