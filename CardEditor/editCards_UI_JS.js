var AddText = 0;
var AddPicture = 0;

window.onload = function() {
    deselectFieldAdding()
    deselectFieldDefault()
  };

function objSChange(){

    elementSelected = document.getElementById("objS").value;

    if(elementSelected == "textField"){

        document.getElementById("fontSize").style.visibility="visible";
        document.getElementById("textFieldFontSize").style.visibility="visible";
        document.getElementById("font").style.visibility="visible";
        document.getElementById("textFieldFont").style.visibility="visible";

    }
    if(elementSelected == "picture"){

        document.getElementById("fontSize").style.visibility="hidden";
        document.getElementById("textFieldFontSize").style.visibility="hidden";
        document.getElementById("font").style.visibility="hidden";
        document.getElementById("textFieldFont").style.visibility="hidden";

    }
};

function deleteCheckBoxChange(){
    deleteCheck = document.getElementById("deleteFieldCheckbox").checked
    if(deleteCheck){
        document.getElementById("buttonDeleteField").disabled = false; 
        deleteCheck = document.getElementById("buttonDeleteField").style.color = "black"
    }else{
        document.getElementById("buttonDeleteField").disabled = true; 
        deleteCheck = document.getElementById("buttonDeleteField").style.color = "darkgrey"
    }
}

function ClickbuttonDeleteField(){
    document.getElementById("buttonDeleteField").disabled = true; 
    deleteCheck = document.getElementById("buttonDeleteField").style.color = "darkgrey"
    document.getElementById("deleteFieldCheckbox").checked = false;
}

function centerChange(){

    if(document.getElementById('radioCenterNo').checked) {
        document.getElementById("textFieldXcor").disabled = false;
    }
    if(document.getElementById('radioCenterYes').checked) {
        document.getElementById("textFieldXcor").disabled = true;
    }

};

function buttonAddTextField(){

    if(AddText == 0){
        AddText = 1
        AddPicture = 0

        document.getElementById("addTextField").style.visibility="visible";
        document.getElementById("buttonAddTextFieldSubmit").style.visibility="visible";
    
        document.getElementById("textFieldPicture").style.visibility="hidden";
        document.getElementById("buttonAddPictureSubmit").style.visibility="hidden";
    }else{
        AddText = 0
        AddPicture = 0
        deselectFieldAdding();
    }

};

function buttonTextFieldSubmit(){
    deselectFieldAdding()
    AddPicture = 0
    AddText = 0
}

function buttonAddPictureField(){

    if(AddPicture == 0){
        AddPicture = 1
        AddText = 0
        document.getElementById("addTextField").style.visibility="hidden";
        document.getElementById("buttonAddTextFieldSubmit").style.visibility="hidden";

        document.getElementById("textFieldPicture").style.visibility="visible";
        document.getElementById("buttonAddPictureSubmit").style.visibility="visible";
    }else{
        AddPicture = 0
        AddText = 0
        deselectFieldAdding();
    }
};

function buttonPictureSubmit(){
    deselectFieldAdding();
    document.getElementById("textFieldPicture").value = ""
    AddPicture = 0
    AddText = 0
}

function deselectFieldAdding(){

    document.getElementById("addTextField").style.visibility="hidden";
    document.getElementById("buttonAddTextFieldSubmit").style.visibility="hidden";
    document.getElementById("textFieldPicture").style.visibility="hidden";
    document.getElementById("buttonAddPictureSubmit").style.visibility="hidden";
}

function deselectFieldDefault(){

    document.getElementById("textFieldDefault").style.visibility="hidden";
    document.getElementById("buttonAddDefaultSubmit").style.visibility="hidden";
}

function defaultCheckBoxChange(){
    deleteCheck = document.getElementById("defaultFieldCheckbox").checked
    if(deleteCheck){
        document.getElementById("textFieldDefault").style.visibility="visible"; 
        document.getElementById("buttonAddDefaultSubmit").style.visibility="visible"; 
    }else{
        deselectFieldDefault()
    }
}

function buttonDefaultSubmit(){
    deselectFieldDefault()
    document.getElementById("textFieldDefault").value = ""
    document.getElementById("defaultFieldCheckbox").checked = false;
}
