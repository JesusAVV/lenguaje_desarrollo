window.addEventListener("Keydown", (e)=>{
    if(e.KeyCode===13){
        loguear()
    }
})

function loguear() {
    let user=document.getElementById("full_name").value
    let pass=document.getElementById("password").value
    let email=document.getElementById("email").value

    if (user==="Ricardo Hidalgo" && pass==="1234" && email==="ricardohidalgo2004@gmail.com"){

        window.location.href="../../../innovacomputer_index.html"
    }

    else{
        alert("Datos Incorrectos")
    }
}