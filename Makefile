default:
	make runSetup -j

runSetup: dockers npm python
	
moo:
	python process1.py | cowsay

conda:
	conda activate virtool@5.0.0

dockers: 
	docker-compose -f docker/docker-compose.dev.yml up

npm:
	(cd "client" && (npm start))

npmInstall: 
	(cd "client" && (npm install) && (npm start))

test:
	(cd "client" && (npm test))

python: 
	python run.py --dev --redis-connection-string redis://localhost:6379 server

jobRunner:
	python run.py --dev runner

mongo:
	mongodb-compass &

git:
	gitkraken &

noPy: mongo npm 