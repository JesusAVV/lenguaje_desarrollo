window.addEventListener("Keydown", (e)=>{
    if(e.KeyCode===13){
        loguear()
    }
})

function loguear() {
    let user=document.getElementById("full_name").value;
    let pass=document.getElementById("password").value;
    let email=document.getElementById("email").value;
    const errorMessage = document.getElementById('error-message');

    if (user==="Ricardo Hidalgo" && pass==="1234" && email==="ricardohidalgo2004@gmail.com"){

        window.location.href="../../../innovacomputer_index.html"
    }

    else{
        errorMessage.style.visibility = 'visible';
    }
}


const errorMessage = document.getElementById('error-message');

if (user==="Ricardo Hidalgo" && pass==="1234" && email==="ricardohidalgo2004@gmail.com"){
    
}