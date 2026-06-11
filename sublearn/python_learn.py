# Write your solution here
correct = 4321
attempts = 0
while True:
    k = int(input("PIN: "))
    attempts += 1

    if attempts == 1:
        print("Correct! It only took you one single attempt!")
    if k == correct:
        print(f'Correct! it took you {attempts} attempts')
        break

    print("Wrong")