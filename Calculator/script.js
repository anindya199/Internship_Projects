const displayElement = document.querySelector('.display');
      displayElement.value = localStorage.getItem('calculation');
      let calculation='';
      function updateCalculation(value)
      {
        calculation=calculation+value;
        displayElement.value = calculation;
        console.log(calculation);
      }

      function displayCalculation()
      {
        Number(localStorage.getItem('calculation'));
        displayElement.value = calculation;
        console.log(calculation);
      }