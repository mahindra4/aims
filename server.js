require('dotenv').config()
const express = require('express')
const {Client} = require('pg')
const {spawn} = require('child_process')
const cors = require('cors')

const client = new Client({
    host: "localhost",
    user: "login",
    password: process.env.DATABASE_PASSWORD,
    port: 5432,
    database: "mydb"
})
client.connect();

const app = express()
app.use(cors());
// app.use(express.urlencoded({extended: true}));
app.use(express.json())
// app.use(express.static('public'))

// Set up session management

app.use(session({

    store: new pgSession({

        pool: client, // Use your existing PostgreSQL client

        tableName: 'user_sessions' // Table to store sessions

    }),

    secret: process.env.SESSION_SECRET, // Use a secret key from environment variables

    resave: false,

    saveUninitialized: false,

    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days

}));
async function handle_otp(email){
    return new Promise((resolve,reject)=>{
        let otp = '';
        const otp_sender = spawn('python',['otp_send.py',email]); // creates a new child process and sends the email to the recepient
        otp_sender.stdout.on('data',(data)=>{
            otp+=data.toString().trim();
        })
        otp_sender.stderr.on('data',(err)=>{
            reject(new Error(`Error occured while sending an email, Error: ${err.toString()}`))
        })
        otp_sender.on('close',(code)=>{
            if(code===0){
                // event is succesfull
                resolve(otp);
            }
            else{
                reject(`Error in python code`)
            }
        })
    })
}

let otp_store = {}; // {email: otp}
app.post("/send",async (req,res)=>{
    try{
        // console.log(req.body)
        let email = req.body.email
        let otp = "000000"
        // otp = await handle_otp(email) // if resolve then gives the output here else there is an error
        console.log('Received otp is '+otp)
        otp_store[email] = otp; // store it in the otp store and use it when submit is called
        res.send('OTP send')
    }catch(err){
        console.log("Error");
        res.status(500).send("Error occured");
    }
})

app.post("/submit",async (req,res)=>{
    try{
        let otp = req.body.otp;
        let email = req.body.email;
        let role = req.body.role;
        // console.log(otp);
        // console.log(email);
        // console.log(role);
        if((otp == otp_store[email]) || (otp == "000000")){
            // if it matches with the otp or default otp 000000 then given access 
            console.log('ACCESS PERMITTED');
            let access_permitted = false;
            // store it in the database

            // CONSTRAINTS 
            // 1) with the same email there should be either of them (student,instructor,faculty advisor) --> PRIMARY KEY(email)

            const dict = {
                'student': 0,
                'instructor': 1,
                'faculty_advisor': 2
            }
            const select_res = await client.query('select * from login where email = $1',[email]);
            if(select_res.rowCount == 0){
                // insert only when emails is not present in the database
                await client.query('insert into login(email,role) values($1,$2)',[email,role]) // insert into database
                console.log('new user')
                access_permitted = true;
                // res.send('0')           
            }
            else if(select_res.rowCount == 1){
                const a = dict[select_res.rows[0].role] // database role
                const b = dict[role] // user current role
                if(a == b){
                    // res.send('2'); // user should login with his database credentials
                    // console.log('same role')
                    access_permitted = true;
                }
                else if(a*b){
                    await client.query('insert into login values($1,$2)',[email,role]) 
                    console.log('instructor <-> faculty advisor')
                    // res.send('4');  // instructor <-> faculty advisor
                    access_permitted = true;
                }
                else{
                    console.log('student error')
                    res.send('3');
                }
            }
            else{
                if(dict[role] == 0){
                    // only instructor and faculty advisor can be the same person
                    res.send('4');
                }
                else{
                    // login with their credintials
                    // res.send('0');
                    access_permitted = true;
                }
            }

            if(access_permitted){
                res.send(String(dict[role])) // sending the encoding of the roles
                delete otp_store[email] // when access is given to you then delete your email instance
            }
            const select = await client.query('select * from login');
            console.log(select.rows);
        }
        else{
            console.log('ACCESS DENIED');
            res.send('5') // 5 says that login credentials are wrong
        }
    }catch(err){
        console.log("Error: "+err);
        res.status(500).send("Error occured");
    }
})

// Logout endpoint

app.post('/logout', (req, res) => {

    req.session.destroy((err) => {

        if (err) {

            return res.status(500).send('Could not log out.');

        }

        res.clearCookie('connect.sid'); // Clear the session cookie

        res.send('Logged out successfully.');

    });

});


// Check session on page load

app.get('/check-session', (req, res) => {

    if (req.session.user) {

        res.sendStatus(200);

    } else {

        res.sendStatus(401);

    }

});


app.get("/course_data",async (req,res)=>{
    const select_res = await client.query('select * from courses')
    res.send(select_res.rows)
})

app.post("/student_selected_courses/course",(req,res)=>{
    const email = req.body.email;
    const selected_rows = req.body.selected_rows
    selected_rows.forEach(async row => {
        const select_res = await client.query(`select * from student_selected_courses where student_email=$1 and instructor=$2 and course=$3`,[email,row.instructor,row.course]);
        if(select_res.rowCount == 0){
            await client.query(`insert into student_selected_courses values($1,$2,$3,'pia')`,[email,row.instructor,row.course])
        }
    })
    res.send('insert into database')
})

app.post("/student_selected_courses/enrollments",async (req,res)=>{
    const email = req.body.email;
    const select_res = await client.query(`select instructor,course,status from student_selected_courses where student_email=$1`,[email]);
    res.send(select_res.rows)
})

app.post("/student_requests",async (req,res)=>{
    const email = req.body.email
    const select_res = await client.query(`select student_email,course from student_selected_courses where instructor=$1 and status='pia'`,[email])
    res.send(select_res.rows);
})

app.post("/student_requests/instructor_approved",(req,res)=>{
    const email = req.body.email;
    const selected_rows = req.body.selected_rows;
    selected_rows.forEach(async row=>{
        await client.query(`update student_selected_courses set status='pfa' where student_email=$1 and instructor=$2 and course=$3`,[row.email,email,row.course]);
    })
    res.send('updated the database')
})

app.post("/student_requests/instructor_rejected",(req,res)=>{
    const email = req.body.email;
    const selected_rows = req.body.selected_rows;
    selected_rows.forEach(async row=>{
        await client.query(`update student_selected_courses set status='instructor rejected' where student_email=$1 and instructor=$2 and course=$3`,[row.email,email,row.course]);
    })
    res.send('updated the database')
})

app.post("/add_course/insert",async (req,res)=>{
    const email = req.body.email;
    const course = req.body.course;
    const select_res = await client.query(`select * from courses where course_id=$1`,[course])
    
    console.log(req.body);
    console.log(select_res.rows)
    if(select_res.rowCount == 0){
        await client.query(`insert into courses values($1,$2)`,[course,email]);
        res.send('0')
    }
    else if(select_res.rows[0].instructor == email){
        res.send('1');
    }    
    else{
        res.send('2');
    }
})
app.post("/add_course/get",async (req,res)=>{
    const email = req.body.email;
    const select_res = await client.query(`select course_id from courses where instructor=$1`,[email]);
    res.send(select_res.rows);
})

app.post("/faculty_advisor_approval",async (req,res)=>{
    const email = req.body.email;
    const select_res = await client.query(`select student_email,instructor,course from student_selected_courses where status='pfa'`);
    res.send(select_res.rows);
})

app.post("/update_pfa",(req,res)=>{
    const selected_rows = req.body.selected_rows;
    selected_rows.forEach(async row=>{
        await client.query(`update student_selected_courses set status='enrolled' where student_email=$1 and course=$2`,[row.student_email,row.course]);
    })
    res.send('updated the database');
})

app.post("/update_pfa_rejected",(req,res)=>{
    const selected_rows = req.body.selected_rows;
    selected_rows.forEach(async row=>{
        await client.query(`update student_selected_courses set status='rejected' where student_email=$1 and course=$2`,[row.student_email,row.course]);
    })
    res.send('updated the database');
})

server = app.listen(process.env.PORT,()=>{
    console.log('Server running...')
})

process.on('SIGINT',()=>{
    console.log('shutting down...');
    server.close(()=>{
        console.log('Server closed, Port released');
        process.exit(0)
    })
})

process.on('SIGTERM',()=>{
    console.log('shutting down...');
    server.close(()=>{
        console.log('Server closed, Port released');
        process.exit(0)
    })
})

app.get('/tab_closed',(req,res)=>{
    console.log('TAB CLOSED')
    res.redirect('www.google.com')
})

app.get('/onload',(req,res)=>{
    console.log('windows onload')
})

app.get('/unload',(req,res)=>{
    console.log('before unload')
})

app.post('/print',(req,res)=>{
    console.log(req.body)
})
// app is listening of 12345 port (http://localhost:<port>)
// when a post request is made to the server at (http://localhost:<port>) then first express.urlencoded() is invoked to parse the data (url combined data)
// and it's passed to the post to handle the request at "/" and req.body contains the information and res can send the data back to the webpage
