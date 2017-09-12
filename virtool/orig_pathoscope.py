import os
import re
import sys
import csv
import math


def findSamAlignScore(l):
	useMapq = True
	readL = 1.*len(l[9])
	for i in range(11, len(l)):
		if useMapq and l[i].startswith('AS:i:'):
			aScore=int(l[i][5:])
			useMapq = False
		elif l[i].startswith('YS:i:'):
			aScore+=int(l[i][5:])
			readL = 2*readL # For paired end we simply multiply read length by 2
			break
	if useMapq:
		aScore = None
	else:
		aScore = aScore+readL
	return aScore


def rescale_samscore(U, NU, maxScore, minScore):
	if (minScore < 0):
		scalingFactor = 100.0 / (maxScore - minScore)
	else:
		scalingFactor = 100.0 / (maxScore)
	for rIdx in U:
		if (minScore < 0):
			U[rIdx][1][0] = U[rIdx][1][0] - minScore
		U[rIdx][1][0] = math.exp(U[rIdx][1][0] * scalingFactor)
		U[rIdx][3] = U[rIdx][1][0]
	for rIdx in NU:
		NU[rIdx][3] = 0.0
		for i in range(0, len(NU[rIdx][1])):
			if (minScore < 0):
				NU[rIdx][1][i] = NU[rIdx][1][i] - minScore
			NU[rIdx][1][i] = math.exp(NU[rIdx][1][i] * scalingFactor)
			if NU[rIdx][1][i] > NU[rIdx][3]:
				NU[rIdx][3] = NU[rIdx][1][i]
	return (U, NU)


def find_entry_score(ln, l, aliFormat, pScoreCutoff):
	mxBitSc = 700
	sigma2 = 3
	skipFlag = False
	if (aliFormat == 0): # gnu-sam
		pScore = float(l[12].split(':')[2])
		if (pScore < pScoreCutoff):
			skipFlag = True
	elif (aliFormat == 1): # sam
		pScore = findSamAlignScore(l)
		if pScore is None:
			mapq = float(l[4])
			mapq2 = mapq/(-10.0)
			pScore = 1.0 - pow(10,mapq2)
			if (pScore < pScoreCutoff):
				skipFlag = True
	elif (aliFormat == 2): # bl8
		eVal = float(l[10])
		if (eVal > pScoreCutoff):
			skipFlag = True
		bitSc = float(l[11])/sigma2
		if bitSc > mxBitSc:
			bitSc = mxBitSc
		pScore = math.exp(bitSc)
	#pScore = int(round(pScore*100)) # Converting to integer to conserve memory space
	#if pScore < 1:
	#	skipFlag = true
	return (pScore, skipFlag)


def conv_align2GRmat(aliDfile, pScoreCutoff, aliFormat):
    in1 = open(aliDfile, 'r')
    U = {}
    NU = {}
    h_readId = {}
    h_refId = {}
    genomes = []
    read = []
    gCnt = 0
    rCnt = 0

    maxScore = None
    minScore = None
    for ln in in1:
        if (ln[0] == '@' or ln[0] == '#'):
            continue

        l = ln.split('\t')

        readId = l[0]
        if (aliFormat == 0 or aliFormat == 1):  # gnu-sam or sam
            if int(l[1]) & 0x4 == 4:  # bitwise FLAG - 0x4 : segment unmapped
                continue
            refId = l[2]
        elif (aliFormat == 2):  # bl8
            refId = l[1]

        if refId == '*':
            continue

        # refId=refId.split("ti:")[-1]
        mObj = re.search(r'ti\|(\d+)\|org\|([^|]+)\|gi', refId)
        if mObj:
            refId = "ti|" + mObj.group(1) + "|org|" + mObj.group(2)
        else:
            mObj = re.search(r'ti\|(\d+)\|', refId)
            if mObj and mObj.group(1) != "-1":
                refId = "ti|" + mObj.group(1)

        (pScore, skipFlag) = find_entry_score(ln, l, aliFormat, pScoreCutoff)
        if skipFlag:
            continue
        if ((maxScore == None) or (pScore > maxScore)):
            maxScore = pScore
        if ((minScore == None) or (pScore < minScore)):
            minScore = pScore

        gIdx = h_refId.get(refId, -1)
        if gIdx == -1:
            gIdx = gCnt
            h_refId[refId] = gIdx
            genomes.append(refId)
            gCnt += 1

        rIdx = h_readId.get(readId, -1)
        if rIdx == -1:
            # hold on this new read
            # first, wrap previous read profile and see if any previous read has a same profile with that!
            rIdx = rCnt
            h_readId[readId] = rIdx
            read.append(readId)
            rCnt += 1
            U[rIdx] = [[gIdx], [pScore], [float(pScore)], pScore]
        else:
            if (rIdx in U):
                if gIdx in U[rIdx][0]:
                    continue
                NU[rIdx] = U[rIdx]
                del U[rIdx]
            if gIdx in NU[rIdx][0]:
                continue
            NU[rIdx][0].append(gIdx)
            NU[rIdx][1].append(pScore)
            if pScore > NU[rIdx][3]:
                NU[rIdx][3] = pScore
                #			length = len(NU[rIdx][1])
                #			NU[rIdx][2] = [1.0/length]*length

    in1.close()

    if (aliFormat == 1):  # sam
        (U, NU) = rescale_samscore(U, NU, maxScore, minScore)

    del h_refId, h_readId
    for rIdx in U:
        U[rIdx] = [U[rIdx][0][0], U[rIdx][1][0]]  # keep gIdx and score only
    for rIdx in NU:
        pScoreSum = sum(NU[rIdx][1])
        NU[rIdx][2] = [k / pScoreSum for k in NU[rIdx][1]]  # Normalizing pScore

    return U, NU, genomes, read


def pathoscope_em(U, NU, genomes, maxIter, emEpsilon, verbose, piPrior, thetaPrior):
    G = len(genomes)

    ### Initial values
    pi = [1. / G for _ in genomes]
    initPi = pi
    theta = [1. / G for _ in genomes]

    pisum0 = [0 for _ in genomes]
    Uweights = [U[i][1] for i in U]  # weights for unique reads...
    maxUweights = 0
    Utotal = 0
    if Uweights:
        maxUweights = max(Uweights)
        Utotal = sum(Uweights)
    for i in U:
        pisum0[U[i][0]] += U[i][1]

    # pisum0/Utotal would be the weighted proportions of unique reads assigned to each genome (weights are alignment scores)_.

    # need to change the structure for U matrix
    # notes NU weights are unnormalized
    # pull out a weighted likelihood score

    ### data structure
    ### 3 unique reads: 2 reads to genome1 and 1 read to genome4: readnum:[genome,reascore]
    # U = {0: 0, 1: 0, 2: 3}
    # U = {0: [0,1], 1: [0,.5], 2: [3,1]}
    ### non-unique reads: 3 total reads  readnum:[[genomes],[qij],[xij]]
    # NU = {0: [[0, 2, 3], [0.4, 0.2, 0.4] , [0.33, 0.33, 0.33],.4, 1: [[0, 1], [0.6, 0.4] , [0.5,0.5]], 2: [[1, 3], [0.5, 0.5] , [0.5,0.5]]}
    ### Genome hash
    # genomes = {0:"ecoli", 1:"strep", 2:"anthrax", 3:"plague"}
    # NUweights = [max(NU[i][1]) for i in NU] # weights for non-unique reads...
    NUweights = [NU[i][3] for i in NU]  # weights for non-unique reads...
    maxNUweights = 0
    NUtotal = 0
    if NUweights:
        maxNUweights = max(NUweights)
        NUtotal = sum(NUweights)
    priorWeight = max(maxUweights, maxNUweights)
    lenNU = len(NU)
    if lenNU == 0:
        lenNU = 1

    for i in range(maxIter):  ## EM iterations--change to convergence
        pi_old = pi
        thetasum = [0 for k in genomes]

        # E Step

        for j in NU:  # for each non-uniq read, j
            z = NU[j]
            ind = z[0]  # a set of any genome mapping with j
            pitmp = [pi[k] for k in ind]  ### get relevant pis for the read
            thetatmp = [theta[k] for k in ind]  ### get relevant thetas for the read
            xtmp = [1. * pitmp[k] * thetatmp[k] * z[1][k] for k in range(len(ind))]  ### Calculate unormalized xs
            xsum = sum(xtmp)
            if xsum == 0:
                xnorm = [0.0 for k in xtmp]  ### Avoiding dividing by 0 at all times
            else:
                xnorm = [1. * k / xsum for k in xtmp]  ### Normalize new xs

            NU[j][2] = xnorm  ## Update x in NU

            for k in range(len(ind)):
                # thetasum[ind[k]] += xnorm[k]   		### Keep running tally for theta
                thetasum[ind[k]] += xnorm[k] * NU[j][3]  ### Keep weighted running tally for theta

        # M step
        pisum = [thetasum[k] + pisum0[k] for k in range(len(thetasum))]  ### calculate tally for pi
        pip = piPrior * priorWeight  # pi prior - may be updated later
        # pi = [(1.*k+pip)/(len(U)+len(NU)+pip*len(pisum)) for k in pisum]  		## update pi
        # pi = [1.*k/G for k in pisum]  		## update pi
        totaldiv = Utotal + NUtotal
        if totaldiv == 0:
            totaldiv = 1
        pi = [(1. * k + pip) / (Utotal + NUtotal + pip * len(pisum)) for k in pisum]  ## update pi
        if (i == 0):
            initPi = pi

        thetap = thetaPrior * priorWeight  # theta prior - may be updated later
        NUtotaldiv = NUtotal
        if NUtotaldiv == 0:
            NUtotaldiv = 1
        theta = [(1. * k + thetap) / (NUtotaldiv + thetap * len(thetasum)) for k in thetasum]
        # theta = [(1.*k+thetap)/(lenNU+thetap*len(thetasum)) for k in thetasum]

        cutoff = 0.0
        for k in range(len(pi)):
            cutoff += abs(pi_old[k] - pi[k])
        if verbose:
            print("[%d]%g" % (i, cutoff))
        if (cutoff <= emEpsilon or lenNU == 1):
            break

    return initPi, pi, theta, NU


def out_initial_align_matrix(*args, **kwargs):
    pass


def computeBestHit(U, NU, genomes, read):
    bestHitReads = [0.0 for _ in genomes]
    level1Reads = [0.0 for _ in genomes]
    level2Reads = [0.0 for _ in genomes]
    for i in U:
        bestHitReads[U[i][0]] += 1
        level1Reads[U[i][0]] += 1
    for j in NU:
        z = NU[j]
        ind = z[0]
        xnorm = z[2]
        bestGenome = max(xnorm)
        numBestGenome = 0
        for i in range(len(xnorm)):
            if (xnorm[i] == bestGenome):
                numBestGenome += 1
        if (numBestGenome == 0):
            numBestGenome = 1
        for i in range(len(xnorm)):
            if (xnorm[i] == bestGenome):
                bestHitReads[ind[i]] += 1.0 / numBestGenome
                if (xnorm[i] >= 0.5):
                    level1Reads[ind[i]] += 1
                elif (xnorm[i] >= 0.01):
                    level2Reads[ind[i]] += 1

    nG = len(genomes)
    nR = len(read)
    bestHit = [bestHitReads[k] / nR for k in range(nG)]
    level1 = [level1Reads[k] / nR for k in range(nG)]
    level2 = [level2Reads[k] / nR for k in range(nG)]
    return bestHitReads, bestHit, level1, level2


def pathoscope_reassign(pathoIdOptions):
    out_matrix = pathoIdOptions.out_matrix_flag
    verbose = pathoIdOptions.verbose
    scoreCutoff = pathoIdOptions.score_cutoff
    expTag = pathoIdOptions.exp_tag
    ali_format = pathoIdOptions.ali_format
    ali_file = pathoIdOptions.ali_file
    outdir = pathoIdOptions.outdir
    emEpsilon = pathoIdOptions.emEpsilon
    maxIter = pathoIdOptions.maxIter
    upalign = not (pathoIdOptions.noalign)
    piPrior = pathoIdOptions.piPrior
    thetaPrior = pathoIdOptions.thetaPrior
    noCutOff = pathoIdOptions.noCutOff

    if float(os.stat(ali_file).st_size) < 1.0:
        print('the alignment file [%s] is empty.' % ali_file)
        sys.exit(1)

    if ali_format == 'gnu-sam':
        aliFormat = 0
    elif ali_format == 'sam':  # standard sam
        aliFormat = 1
    elif ali_format == 'bl8':  # blat m8 format
        aliFormat = 2
    else:
        return

    (U, NU, genomes, reads) = conv_align2GRmat(ali_file, scoreCutoff, aliFormat)

    nG = len(genomes)
    nR = len(reads)

    if verbose:
        print("EM iteration...")
        print("(Genomes,Reads)=%dx%d" % (nG, nR))
        print("Delta Change:")

    (bestHitInitialReads, bestHitInitial, level1Initial, level2Initial) = computeBestHit(U, NU, genomes, reads)

    (initPi, pi, _, NU) = pathoscope_em(U, NU, genomes, maxIter, emEpsilon, verbose,
                                        piPrior, thetaPrior)
    tmp = zip(initPi, genomes)
    tmp = sorted(tmp, reverse=True)  # similar to sort row

    if out_matrix:
        initialGuess = outdir + os.sep + expTag + '-initGuess.txt'
        oFp = open(initialGuess, 'w')
        csv_writer = csv.writer(oFp, delimiter='\t')
        csv_writer.writerows(tmp)
        oFp.close()

    del tmp

    (bestHitFinalReads, bestHitFinal, level1Final, level2Final) = \
        computeBestHit(U, NU, genomes, reads)

    if out_matrix:
        finalGuess = outdir + os.sep + expTag + '-finGuess.txt'
        oFp = open(finalGuess, 'w')
        tmp = zip(pi, genomes)
        tmp = sorted(tmp, reverse=True)
        csv_writer = csv.writer(oFp, delimiter='\t')
        csv_writer.writerows(tmp)
        oFp.close()

    finalReport = outdir + os.sep + expTag + '-' + ali_format + '-report.tsv'
    header = ['Genome', 'Final Guess', 'Final Best Hit', 'Final Best Hit Read Numbers', \
              'Final High Confidence Hits', 'Final Low Confidence Hits', 'Initial Guess', \
              'Initial Best Hit', 'Initial Best Hit Read Numbers', \
              'Initial High Confidence Hits', 'Initial Low Confidence Hits']
    (x1, x2, x3, x4, x5, x6, x7, x8, x9, x10, x11) = write_tsv_report(
        finalReport, nR, nG, pi, genomes, initPi, bestHitInitial, bestHitInitialReads,
        bestHitFinal, bestHitFinalReads, level1Initial, level2Initial, level1Final,
        level2Final, header, noCutOff)

    reAlignfile = ali_file
    if upalign:
        reAlignfile = rewrite_align(U, NU, ali_file, scoreCutoff, aliFormat, outdir)

    return (finalReport, x2, x3, x4, x5, x1, x6, x7, x8, x9, x10, x11, reAlignfile)


def ensure_dir(d):
	if not os.path.exists(d):
		os.makedirs(d)


def find_updated_score(NU, rIdx, gIdx):
	try:
		index = NU[rIdx][0].index(gIdx);
	except ValueError:
		print('Value Error: %s' % gIdx)
		return (0., 0.)
	pscoreSum = 0.0
	for pscore in NU[rIdx][1]:
		pscoreSum += pscore
	pscoreSum /= 100
	upPscore = NU[rIdx][2][index]
	return (upPscore, pscoreSum)


def write_tsv_report(finalReport, nR, nG, pi, genomes, initPi, bestHitInitial, bestHitInitialReads,
		bestHitFinal, bestHitFinalReads, level1Initial, level2Initial, level1Final, level2Final,
		header, noCutOff):
	with open(finalReport, 'w') as oFp:
		tmp = zip(pi,genomes, initPi, bestHitInitial, bestHitInitialReads, bestHitFinal,
			bestHitFinalReads, level1Initial, level2Initial, level1Final, level2Final)
		tmp = sorted(tmp,reverse=True) # Sorting based on Final Guess
		x1, x2, x3, x4, x5, x6, x7, x8, x9, x10, x11 = zip(*tmp)
		for i in range(len(x10)):
			if (not(noCutOff) and x1[i] < 0.01 and x10[i] <= 0 and x11[i] <= 0):
				break
			if i == (len(x10)-1):
				i += 1
		tmp = zip (x2[:i], x1[:i], x6[:i], x7[:i], x10[:i], x11[:i], x3[:i], x4[:i], x5[:i], x8[:i], x9[:i]) # Changing the column order here
		csv_writer = csv.writer(oFp, delimiter='\t')
		header1 = ['Total Number of Aligned Reads:', nR, 'Total Number of Mapped Genomes:', nG]
		csv_writer.writerow(header1)
		csv_writer.writerow(header)
		csv_writer.writerows(tmp)
	return (x1, x2, x3, x4, x5, x6, x7, x8, x9, x10, x11)


def rewrite_align(U, NU, aliDfile, pScoreCutoff, aliFormat, outdir):
    ensure_dir(outdir)
    f = os.path.basename(aliDfile)
    reAlignfile = outdir + os.sep + 'updated_' + f

    with open(reAlignfile, 'w') as of:
        with open(aliDfile, 'r') as in1:
            h_readId = {}
            h_refId = {}
            genomes = []
            read = []
            gCnt = 0
            rCnt = 0

            mxBitSc = 700
            sigma2 = 3
            for ln in in1:
                if (ln[0] == '@' or ln[0] == '#'):
                    of.write(ln)
                    continue

                l = ln.split('\t')

                readId = l[0]
                if (aliFormat == 0 or aliFormat == 1):  # gnu-sam or sam
                    # refId=l[2].split("ti:")[-1]
                    refId = l[2]
                    if int(l[1]) & 0x4 == 4:  # bitwise FLAG - 0x4 : segment unmapped
                        continue
                elif (aliFormat == 2):  # bl8
                    refId = l[1]

                if refId == '*':
                    continue

                mObj = re.search(r'ti\|(\d+)\|org\|([^|]+)\|gi', refId)
                if mObj:
                    refId = "ti|" + mObj.group(1) + "|org|" + mObj.group(2)
                else:
                    mObj = re.search(r'ti\|(\d+)\|', refId)
                    if mObj and mObj.group(1) != "-1":
                        refId = "ti|" + mObj.group(1)

                (_, skipFlag) = find_entry_score(ln, l, aliFormat, pScoreCutoff)
                if skipFlag:
                    continue

                gIdx = h_refId.get(refId, -1)
                if gIdx == -1:
                    gIdx = gCnt
                    h_refId[refId] = gIdx
                    genomes.append(refId)
                    gCnt += 1

                rIdx = h_readId.get(readId, -1)
                if rIdx == -1:
                    # hold on this new read
                    # first, wrap previous read profile and see if any previous read has a same profile with that!
                    rIdx = rCnt
                    h_readId[readId] = rIdx
                    read.append(readId)
                    rCnt += 1
                    if rIdx in U:
                        of.write(ln)
                        continue

                if rIdx in NU:
                    if (aliFormat == 0):  # gnu-sam
                        scoreComponents = l[12].split(':')
                        (upPscore, pscoreSum) = find_updated_score(NU, rIdx, gIdx)
                        scoreComponents[2] = str(upPscore * pscoreSum)
                        if (scoreComponents[2] < pScoreCutoff):
                            continue
                        l[12] = ':'.join(scoreComponents)
                        ln = '\t'.join(l)
                        of.write(ln)
                    elif (aliFormat == 1):  # sam
                        (upPscore, pscoreSum) = find_updated_score(NU, rIdx, gIdx)
                        if (upPscore < pScoreCutoff):
                            continue
                        if (upPscore >= 1.0):
                            upPscore = 0.999999
                        mapq2 = math.log10(1 - upPscore)
                        l[4] = str(int(round(-10.0 * mapq2)))
                        ln = '\t'.join(l)
                        of.write(ln)
                    elif (aliFormat == 2):  # bl8
                        (upPscore, pscoreSum) = find_updated_score(NU, rIdx, gIdx)
                        score = upPscore * pscoreSum
                        if score <= 0.0:
                            continue
                        bitSc = math.log(score)
                        if bitSc > mxBitSc:
                            bitSc = mxBitSc
                        l[10] = str(bitSc * sigma2)
                        ln = '\t'.join(l)
                        of.write(ln)

    return reAlignfile
