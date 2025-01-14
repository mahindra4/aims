const express = require('express')
const {Client} = require('pg')
const {spawn} = require('child_process')
const cors = require('cors')

PORT = 3000;

const app = express()
const client = new Client({
    host: "localhost",
    user: "login",
    password: process.env.DATABASE_PASSWORD,
    port: 5432,
    database: "mydb"
})
client.connect();

app.use(cors());
app.use(express.urlencoded({extended: true}));
// app.use(express.static('public'))


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
        console.log(otp);
        console.log(email);
        console.log(role);
        if((otp == otp_store[email]) || (otp == "000000")){
            // if it matches with the otp or default otp 000000 then given access 
            console.log('ACCESS PERMITTED');
            delete otp_store[email] // when access is given to you then delete your email instance
           
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
                res.send('0')
            }
            else{
                const a = dict[select_res.rows[0].role] // database role
                const b = dict[role] // user current role
                if(a == b){
                    res.send('2'); // user should login with his database credentials
                    console.log('same role')
                }
                else if(a*b){
                    await client.query('insert into login values($1,$2)',[email,role]) 
                    console.log('instructor <-> faculty advisor')
                    res.send('4');  // instructor <-> faculty advisor
                }
                else{
                    console.log('student error')
                    res.send('3');
                }
            }


            // else if(select_res.rows[0].role == role){
            //     res.send('0') // 0 says that login credentials are correct    
            // }
            // else if(role == 'student'){
            //     res.send('3') // a stdent can't become instructor or faculty advisor
            // }
            // else{
            //     await client.query('insert into login values($1,$2)',[email,role]) 
            //     res.send('4') // instructor <-> faculty advisor
            // }
            const select = await client.query('select * from login');
            console.log(select.rows);
        }
        else{
            console.log('ACCESS DENIED');
            res.send('1') // 1 says that login credentials are wrong
        }
    }catch(err){
        console.log("Error: "+err);
        res.status(500).send("Error occured");
    }
})


app.listen(PORT)

// app is listening of 3000 port (http://localhost:3000)
// when a post request is made to the server at (http://localhost:3000) then first express.urlencoded() is invoked to parse the data (url combined data)
// and it's passed to the post to handle the request at "/" and req.body contains the information and res can send the data back to the webpage