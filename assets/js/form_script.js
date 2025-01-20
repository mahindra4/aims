// require('dotenv').config()
const PORT = 65535
document.getElementById("sendButton").addEventListener("click",()=>{
    const email = document.getElementById("email").value
    sendButton.disabled = true
    sessionStorage.setItem('email',email)
    fetch(`http://localhost:${PORT}/send`,{
        method: 'POST',
        headers: {
            'Content-type': 'application/json'
        },
        body: JSON.stringify({
            email: `${email}`
        })
    })
    .then(response => {
        console.log(response);
        return response.text()
    })
    .then(data => {
        // Show a success message or response handling
        console.log(`Response by server: ${data}`)
        // alert("email sent please check your inbox for the OTP");
    })
    .catch(error => {
        console.error("Error:", error);
        alert("Error occurred while sending email."+error);
        sendButton.disabled = false;
    });
    
})

document.getElementById("submitButton").addEventListener("click",()=>{
    const email = document.getElementById("email").value; 
    const otp = document.getElementById("otp").value;
    const role = document.getElementById("role").value;
    fetch(`http://localhost:${PORT}/submit`,{
        method: 'POST',
        headers: {
            'Content-type': 'application/json'
        },
        body: JSON.stringify({
            email: `${email}`,
            otp: `${otp}`,
            role: `${role}`            
        })
    })
    .then(response => {
        // console.log(response);
        return response.text()
    })
    .then(data => {
        // Show a success message or response handling
        console.log(`data: ${data}`)
        
        if(data == '0'){
            //student role
            window.location = "./student/course.html"
        }
        else if(data == '1'){
            // instructor role
            window.location = "main.html"
        }
        else if(data == '2'){
            // faculty advisor
            window.location = "main.html"
        }
        else if(data == '3' || data == '4'){
            alert("a stdent can't become instructor or faculty advisor or vice verse");
        }
        else if(data == '5'){
            alert("OTP is incorrect! Try again")
        }

        // if(data == '1'){
        //     // otp is incorrect
        //     alert("OTP is incorrect! Try again")
        // }
        // else if(data == '0'){
        //     // on success
        //     window.location = "main.html";
        // }
        // else if(data == '2'){
        //     window.location = "main.html";
        // }
        // else if(data == '4'){
        //     window.location = "main.html";
        // }
        // else if(data == '3' || data == '5'){
        //     alert("a stdent can't become instructor or faculty advisor or vice verse");
        // }
    })
    .catch(error => {
        console.error("Error:", error);
        alert("Error occurred while sending form details."+error);
    });
})